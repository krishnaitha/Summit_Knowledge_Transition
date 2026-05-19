import 'server-only';

import { Buffer } from 'buffer';

import sql from '@/lib/db';
import { extractTextFromFile } from '@/lib/documents/parse';
import { processDocumentRecord } from '@/lib/documents/process';
import { uploadFile } from '@/lib/storage/local';
import type { DocumentConnectorRecord } from '@/lib/types/database';

type ConnectorConfig = Record<string, unknown>;

const SAMPLE_FIXTURES = {
  confluence: [
    {
      id: 'sample-confluence-1',
      title: 'Confluence onboarding checklist',
      html: '<h1>Onboarding checklist</h1><p>Confirm access, review the KT owner map, and verify the team handoff timeline.</p>',
    },
    {
      id: 'sample-confluence-2',
      title: 'Support escalation guide',
      html: '<h1>Support escalation guide</h1><p>Escalate severity 1 issues to the incident manager and document the action items.</p>',
    },
  ],
  sharepoint: [
    {
      id: 'sample-sharepoint-1',
      title: 'SharePoint project brief.docx',
      text: 'Project brief: capture objectives, stakeholders, and handover notes before the transition starts.',
    },
    {
      id: 'sample-sharepoint-2',
      title: 'SharePoint runbook.txt',
      text: 'Runbook: validate the checklist, confirm backups, and notify the owner after each deployment.',
    },
  ],
} as const;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function setConnectorSyncState(
  connectorId: string,
  status: DocumentConnectorRecord['last_sync_status'],
  error: string | null = null,
) {
  await sql`
    UPDATE document_connectors
    SET last_sync_status = ${status},
        last_sync_error = ${error},
        last_synced_at = ${status === 'success' ? new Date().toISOString() : null},
        updated_at = NOW()
    WHERE id = ${connectorId}
  `;
}

async function upsertImportedDocument(params: {
  connector: DocumentConnectorRecord;
  itemId: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  sourceUrl: string;
}) {
  const existing = await sql<{ id: string }[]>`
    SELECT id
    FROM documents
    WHERE source_connector_id = ${params.connector.id}
      AND source_item_id = ${params.itemId}
    LIMIT 1
  `;

  if (existing[0]?.id) {
    await sql`DELETE FROM document_chunks WHERE document_id = ${existing[0].id}`;
    await sql`
      UPDATE documents
      SET file_name = ${params.fileName},
          file_url = ${params.fileUrl},
          file_type = ${params.fileType},
          source_provider = ${params.connector.provider},
          source_url = ${params.sourceUrl},
          source_synced_at = NOW(),
          uploaded_by = ${params.connector.created_by}
      WHERE id = ${existing[0].id}
    `;
    return existing[0].id;
  }

  const rows = await sql<{ id: string }[]>`
    INSERT INTO documents (
      project_id,
      file_name,
      file_url,
      file_type,
      uploaded_by,
      chunk_count,
      source_connector_id,
      source_provider,
      source_item_id,
      source_url,
      source_synced_at
    )
    VALUES (
      ${params.connector.project_id},
      ${params.fileName},
      ${params.fileUrl},
      ${params.fileType},
      ${params.connector.created_by},
      0,
      ${params.connector.id},
      ${params.connector.provider},
      ${params.itemId},
      ${params.sourceUrl},
      NOW()
    )
    RETURNING id
  `;

  return rows[0]?.id as string;
}

async function syncConfluenceConnector(connector: DocumentConnectorRecord) {
  const config = connector.config as ConnectorConfig;
  if (config.demo) {
    let imported = 0;
    for (const item of SAMPLE_FIXTURES.confluence) {
      try {
        const text = htmlToText(item.html);
        const fileUrl = await uploadFile(`${item.title}.txt`, Buffer.from(text, 'utf8'));
        const documentId = await upsertImportedDocument({
          connector,
          itemId: item.id,
          fileName: `${item.title}.txt`,
          fileType: 'txt',
          fileUrl,
          sourceUrl: `${String(config.base_url ?? 'https://demo.atlassian.net/wiki')}/sample/${item.id}`,
        });
        await processDocumentRecord(documentId, connector.project_id, text);
        imported++;
      } catch (error) {
        console.error(`[Confluence Demo Import Error for ${item.id}]`, error);
        throw new Error(
          `Failed to import Confluence item ${item.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return { imported, provider: 'confluence', connectorId: connector.id, demo: true };
  }

  const baseUrl = trimTrailingSlash(asString(config.base_url));
  const spaceKey = asString(config.space_key);
  const authEmail = asString(config.auth_email);
  const accessToken = asString(config.access_token);

  if (!baseUrl || !spaceKey || !authEmail || !accessToken) {
    throw new Error('Confluence connector is missing base URL, space key, email, or API token');
  }

  const headers = {
    Accept: 'application/json',
    Authorization: `Basic ${Buffer.from(`${authEmail}:${accessToken}`).toString('base64')}`,
  };

  let start = 0;
  let imported = 0;
  let pagesSeen = 0;

  while (true) {
    const url = new URL(`${baseUrl}/rest/api/content`);
    url.searchParams.set('spaceKey', spaceKey);
    url.searchParams.set('expand', 'body.storage,version,_links');
    url.searchParams.set('limit', '25');
    url.searchParams.set('start', String(start));

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Confluence request failed with ${response.status}`);
    }

    const data = (await response.json()) as {
      results?: Array<Record<string, unknown>>;
      size?: number;
      total?: number;
    };
    const items = data.results ?? [];
    if (!items.length) break;

    for (const item of items) {
      const itemId = String(item.id ?? '');
      const title = asString(item.title, 'Untitled page');
      const html = asString(
        (item.body as { storage?: { value?: unknown } } | undefined)?.storage?.value,
      );
      const text = htmlToText(html) || title;
      const linkPath = asString((item._links as { webui?: unknown } | undefined)?.webui, '');
      const sourceUrl = linkPath ? `${baseUrl}${linkPath}` : baseUrl;

      if (!itemId) continue;

      const fileUrl = await uploadFile(`${title}.txt`, Buffer.from(text, 'utf8'));
      const documentId = await upsertImportedDocument({
        connector,
        itemId,
        fileName: `${title}.txt`,
        fileType: 'txt',
        fileUrl,
        sourceUrl,
      });

      await processDocumentRecord(documentId, connector.project_id, text);
      imported++;
    }

    pagesSeen += items.length;
    const total = typeof data.total === 'number' ? data.total : pagesSeen;
    start += data.size ?? items.length;
    if (pagesSeen >= total) break;
  }

  return { imported, provider: 'confluence', connectorId: connector.id };
}

async function syncSharePointConnector(connector: DocumentConnectorRecord) {
  const config = connector.config as ConnectorConfig;
  if (config.demo) {
    let imported = 0;
    for (const item of SAMPLE_FIXTURES.sharepoint) {
      try {
        const text = item.text;
        const fileUrl = await uploadFile(item.title, Buffer.from(text, 'utf8'));
        const documentId = await upsertImportedDocument({
          connector,
          itemId: item.id,
          fileName: item.title,
          fileType: item.title.split('.').pop()?.toLowerCase() ?? 'sharepoint',
          fileUrl,
          sourceUrl: `${String(config.site_url ?? 'https://demo.sharepoint.com/sites/KT')}/sample/${item.id}`,
        });
        await processDocumentRecord(documentId, connector.project_id, text);
        imported++;
      } catch (error) {
        console.error(`[SharePoint Demo Import Error for ${item.id}]`, error);
        throw new Error(
          `Failed to import SharePoint item ${item.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return { imported, provider: 'sharepoint', connectorId: connector.id, demo: true };
  }

  const siteUrl = trimTrailingSlash(asString(config.site_url));
  const libraryPath = asString(config.library_path, 'Shared Documents');
  const accessToken = asString(config.access_token);

  if (!siteUrl || !libraryPath || !accessToken) {
    throw new Error('SharePoint connector is missing site URL, library path, or access token');
  }

  const listUrl = new URL(
    `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${libraryPath.replace(/'/g, "''")}')/Files`,
  );
  listUrl.searchParams.set('$select', 'Name,ServerRelativeUrl,TimeLastModified,UniqueId');
  listUrl.searchParams.set('$top', '100');

  const response = await fetch(listUrl, {
    headers: {
      Accept: 'application/json;odata=nometadata',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`SharePoint request failed with ${response.status}`);
  }

  const data = (await response.json()) as { value?: Array<Record<string, unknown>> };
  const items = data.value ?? [];
  let imported = 0;

  for (const item of items) {
    const itemId = asString(item.UniqueId ?? item.ServerRelativeUrl ?? '');
    const name = asString(item.Name ?? 'Untitled file');
    const serverRelativeUrl = asString(item.ServerRelativeUrl ?? '');

    if (!itemId || !serverRelativeUrl) continue;

    const downloadUrl = new URL(serverRelativeUrl, siteUrl).toString();
    const fileResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!fileResponse.ok) {
      throw new Error(`SharePoint file download failed for ${name}`);
    }

    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    const text = await extractTextFromFile(name, buffer);
    const fileUrl = await uploadFile(name, buffer);
    const documentId = await upsertImportedDocument({
      connector,
      itemId,
      fileName: name,
      fileType: name.split('.').pop()?.toLowerCase() ?? 'sharepoint',
      fileUrl,
      sourceUrl: downloadUrl,
    });

    await processDocumentRecord(documentId, connector.project_id, text);
    imported++;
  }

  return { imported, provider: 'sharepoint', connectorId: connector.id };
}

export async function syncDocumentConnector(connectorId: string) {
  const rows = await sql<DocumentConnectorRecord[]>`
    SELECT * FROM document_connectors WHERE id = ${connectorId} LIMIT 1
  `;
  const connector = rows[0] ?? null;

  if (!connector) {
    throw new Error('Connector not found');
  }

  await setConnectorSyncState(connector.id, 'running');

  try {
    const result =
      connector.provider === 'confluence'
        ? await syncConfluenceConnector(connector)
        : await syncSharePointConnector(connector);

    await setConnectorSyncState(connector.id, 'success');
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connector sync failed';
    await setConnectorSyncState(connector.id, 'failed', message);
    throw error;
  }
}
