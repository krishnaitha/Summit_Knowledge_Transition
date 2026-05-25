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
  jira: [
    {
      id: 'KT-101',
      title: 'KT handover dependency map',
      text: 'Create and validate the dependency map before the handover readiness review.',
    },
    {
      id: 'KT-102',
      title: 'Escalation workflow review',
      text: 'Review escalation workflow ownership, SLA expectations, and fallback contacts.',
    },
  ],
  monday: [
    {
      id: 'sample-monday-1',
      title: 'Monday onboarding board item',
      text: 'Onboarding board item: owner assignment, kickoff date, and handoff acceptance status.',
    },
    {
      id: 'sample-monday-2',
      title: 'Monday risk register item',
      text: 'Risk register item: unresolved blockers, severity, and mitigation owner.',
    },
  ],
  onedrive: [
    {
      id: 'sample-onedrive-1',
      title: 'OneDrive transition checklist.docx',
      text: 'Transition checklist from OneDrive covering owners, approvals, and deadlines.',
    },
    {
      id: 'sample-onedrive-2',
      title: 'OneDrive support runbook.txt',
      text: 'Support runbook from OneDrive including escalation path and incident template.',
    },
  ],
  github: [
    {
      id: 'docs/getting-started.md',
      title: 'Getting started guide',
      text: '# Getting started\n\nThis guide explains setup and ownership for KT onboarding.',
    },
    {
      id: 'docs/operations.md',
      title: 'Operations manual',
      text: '# Operations manual\n\nRunbook for monitoring, alerts, and escalation flows.',
    },
  ],
} as const;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function stripJqlQuotes(value: string) {
  return value.replace(/^"+|"+$/g, '').trim();
}

function normalizePath(path: string) {
  return path.replace(/^\/+|\/+$/g, '');
}

function encodePathSegments(path: string) {
  const cleaned = normalizePath(path);
  return cleaned
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function fileExtension(fileName: string) {
  const idx = fileName.lastIndexOf('.');
  if (idx === -1) return 'txt';
  return fileName.slice(idx + 1).toLowerCase();
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

function jiraAdfToText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (!Array.isArray(value) && typeof value !== 'object') return '';

  const walk = (node: unknown): string[] => {
    if (!node) return [];
    if (typeof node === 'string') return [node];
    if (Array.isArray(node)) return node.flatMap((item) => walk(item));
    if (typeof node !== 'object') return [];

    const record = node as Record<string, unknown>;
    const text = asString(record.text);
    const content = walk(record.content);

    return text ? [text, ...content] : content;
  };

  return walk(value).join(' ').replace(/\s+/g, ' ').trim();
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

export async function enqueueDueDocumentConnectorSyncJobs(syncIntervalHours = 24) {
  const boundedHours = Math.max(1, Math.floor(syncIntervalHours));
  const intervalLiteral = `${boundedHours} hours`;

  const rows = await sql<{ id: string }[]>`
    WITH due_connectors AS (
      SELECT dc.id
      FROM document_connectors dc
      WHERE dc.is_active = true
        AND dc.auto_sync_enabled = true
        AND dc.last_sync_status <> 'running'
        AND COALESCE(dc.last_synced_at, dc.updated_at, dc.created_at) <= NOW() - (${intervalLiteral})::interval
        AND NOT EXISTS (
          SELECT 1
          FROM processing_jobs pj
          WHERE pj.type = 'connector_sync'
            AND pj.status IN ('pending', 'running')
            AND pj.payload->>'connectorId' = dc.id::text
        )
    )
    INSERT INTO processing_jobs (type, payload)
    SELECT 'connector_sync', jsonb_build_object('connectorId', due_connectors.id)
    FROM due_connectors
    RETURNING id
  `;

  return rows.length;
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

async function syncJiraConnector(connector: DocumentConnectorRecord) {
  const config = connector.config as ConnectorConfig;
  if (config.demo) {
    let imported = 0;
    for (const item of SAMPLE_FIXTURES.jira) {
      const text = item.text;
      const fileName = `${item.id} - ${item.title}.txt`;
      const fileUrl = await uploadFile(fileName, Buffer.from(text, 'utf8'));
      const documentId = await upsertImportedDocument({
        connector,
        itemId: item.id,
        fileName,
        fileType: 'txt',
        fileUrl,
        sourceUrl: `${String(config.base_url ?? 'https://demo.atlassian.net')}/browse/${item.id}`,
      });
      await processDocumentRecord(documentId, connector.project_id, text);
      imported++;
    }

    return { imported, provider: 'jira', connectorId: connector.id, demo: true };
  }

  const baseUrl = trimTrailingSlash(asString(config.base_url));
  const projectKey = asString(config.project_key).toUpperCase();
  const authEmail = asString(config.auth_email);
  const accessToken = asString(config.access_token);
  const jql = stripJqlQuotes(asString(config.jql, `project = ${projectKey} ORDER BY updated DESC`));

  if (!baseUrl || !projectKey || !authEmail || !accessToken) {
    throw new Error('Jira connector is missing base URL, project key, email, or API token');
  }

  let startAt = 0;
  let imported = 0;

  while (true) {
    const searchUrl = new URL(`${baseUrl}/rest/api/3/search`);
    searchUrl.searchParams.set('jql', jql);
    searchUrl.searchParams.set('startAt', String(startAt));
    searchUrl.searchParams.set('maxResults', '50');
    searchUrl.searchParams.set('fields', 'summary,description,updated,issuetype');

    const response = await fetch(searchUrl, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${authEmail}:${accessToken}`).toString('base64')}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Jira request failed with ${response.status}`);
    }

    const data = (await response.json()) as {
      issues?: Array<Record<string, unknown>>;
      startAt?: number;
      maxResults?: number;
      total?: number;
    };

    const issues = data.issues ?? [];
    if (!issues.length) break;

    for (const issue of issues) {
      const issueKey = asString(issue.key);
      const issueId = asString(issue.id, issueKey);
      const fields = (issue.fields ?? {}) as Record<string, unknown>;
      const summary = asString(fields.summary, issueKey || 'Untitled issue');
      const description = jiraAdfToText(fields.description);
      const text = `Issue: ${issueKey}\nSummary: ${summary}\n\n${description || summary}`;
      const fileName = `${issueKey || issueId} - ${summary}.txt`;

      if (!issueId) continue;

      const fileUrl = await uploadFile(fileName, Buffer.from(text, 'utf8'));
      const documentId = await upsertImportedDocument({
        connector,
        itemId: issueId,
        fileName,
        fileType: 'txt',
        fileUrl,
        sourceUrl: issueKey ? `${baseUrl}/browse/${issueKey}` : baseUrl,
      });

      await processDocumentRecord(documentId, connector.project_id, text);
      imported++;
    }

    const nextStart = (data.startAt ?? startAt) + (data.maxResults ?? issues.length);
    if (nextStart >= (data.total ?? nextStart)) {
      break;
    }
    startAt = nextStart;
  }

  return { imported, provider: 'jira', connectorId: connector.id };
}

async function syncMondayConnector(connector: DocumentConnectorRecord) {
  const config = connector.config as ConnectorConfig;
  if (config.demo) {
    let imported = 0;
    for (const item of SAMPLE_FIXTURES.monday) {
      const text = item.text;
      const fileName = `${item.title}.txt`;
      const fileUrl = await uploadFile(fileName, Buffer.from(text, 'utf8'));
      const documentId = await upsertImportedDocument({
        connector,
        itemId: item.id,
        fileName,
        fileType: 'txt',
        fileUrl,
        sourceUrl: `${String(config.workspace_url ?? 'https://demo.monday.com')}/boards/123456789/pulses/${item.id}`,
      });
      await processDocumentRecord(documentId, connector.project_id, text);
      imported++;
    }

    return { imported, provider: 'monday', connectorId: connector.id, demo: true };
  }

  const apiUrl = trimTrailingSlash(asString(config.api_url, 'https://api.monday.com/v2'));
  const workspaceUrl = trimTrailingSlash(asString(config.workspace_url));
  const boardIdsRaw = asString(config.board_ids);
  const accessToken = asString(config.access_token);

  if (!boardIdsRaw || !accessToken) {
    throw new Error('Monday connector is missing board IDs or API token');
  }

  const boardIds = boardIdsRaw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^\d+$/.test(id));

  if (!boardIds.length) {
    throw new Error('Monday board IDs must be a comma-separated list of numeric board IDs');
  }

  const query = `
    query FetchBoards($boardIds: [ID!]!) {
      boards(ids: $boardIds) {
        id
        name
        items_page(limit: 100) {
          items {
            id
            name
            updated_at
            column_values {
              id
              text
              type
            }
          }
        }
      }
    }
  `;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: { boardIds } }),
  });

  if (!response.ok) {
    throw new Error(`Monday request failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    data?: {
      boards?: Array<{
        id?: string;
        name?: string;
        items_page?: {
          items?: Array<{
            id?: string;
            name?: string;
            updated_at?: string;
            column_values?: Array<{ id?: string; text?: string; type?: string }>;
          }>;
        };
      }>;
    };
    errors?: Array<{ message?: string }>;
  };

  if (data.errors?.length) {
    const message = asString(data.errors[0]?.message, 'Monday GraphQL request failed');
    throw new Error(message);
  }

  const boards = data.data?.boards ?? [];
  let imported = 0;

  for (const board of boards) {
    const boardId = asString(board.id);
    const boardName = asString(board.name, 'Board');
    const items = board.items_page?.items ?? [];

    for (const item of items) {
      const itemId = asString(item.id);
      const itemName = asString(item.name, 'Untitled item');
      if (!itemId) continue;

      const columnLines = (item.column_values ?? [])
        .map((col) => {
          const columnText = asString(col.text);
          if (!columnText) return '';
          return `${asString(col.id, 'column')}: ${columnText}`;
        })
        .filter(Boolean)
        .join('\n');

      const text = [
        `Board: ${boardName}`,
        `Item: ${itemName}`,
        item.updated_at ? `Updated: ${item.updated_at}` : '',
        '',
        columnLines,
      ]
        .filter(Boolean)
        .join('\n');

      const fileName = `${boardName} - ${itemName}.txt`;
      const fileUrl = await uploadFile(fileName, Buffer.from(text, 'utf8'));
      const sourceUrl =
        workspaceUrl && boardId
          ? `${workspaceUrl}/boards/${boardId}/pulses/${itemId}`
          : `${apiUrl}#item-${itemId}`;

      const documentId = await upsertImportedDocument({
        connector,
        itemId,
        fileName,
        fileType: 'txt',
        fileUrl,
        sourceUrl,
      });

      await processDocumentRecord(documentId, connector.project_id, text);
      imported++;
    }
  }

  return { imported, provider: 'monday', connectorId: connector.id };
}

async function syncOneDriveConnector(connector: DocumentConnectorRecord) {
  const config = connector.config as ConnectorConfig;

  if (config.demo) {
    let imported = 0;
    for (const item of SAMPLE_FIXTURES.onedrive) {
      const buffer = Buffer.from(item.text, 'utf8');
      const fileUrl = await uploadFile(item.title, buffer);
      const documentId = await upsertImportedDocument({
        connector,
        itemId: item.id,
        fileName: item.title,
        fileType: fileExtension(item.title),
        fileUrl,
        sourceUrl: `https://onedrive.live.com/?id=${item.id}`,
      });
      await processDocumentRecord(documentId, connector.project_id, item.text);
      imported++;
    }

    return { imported, provider: 'onedrive', connectorId: connector.id, demo: true };
  }

  const driveId = asString(config.drive_id);
  const folderPath = asString(config.folder_path);
  const accessToken = asString(config.access_token);

  if (!driveId || !accessToken) {
    throw new Error('OneDrive connector is missing drive ID or access token');
  }

  const listEndpoint = folderPath
    ? `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encodePathSegments(folderPath)}:/children?$top=200`
    : `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root/children?$top=200`;

  const response = await fetch(listEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OneDrive request failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    value?: Array<{
      id?: string;
      name?: string;
      webUrl?: string;
      file?: Record<string, unknown>;
      ['@microsoft.graph.downloadUrl']?: string;
    }>;
  };

  const items = data.value ?? [];
  let imported = 0;

  for (const item of items) {
    if (!item.file) continue;

    const itemId = asString(item.id);
    const name = asString(item.name, 'Untitled file');
    const downloadUrl = asString(item['@microsoft.graph.downloadUrl']);
    const sourceUrl = asString(item.webUrl, downloadUrl);

    if (!itemId || !downloadUrl) continue;

    const fileResponse = await fetch(downloadUrl);
    if (!fileResponse.ok) {
      throw new Error(`OneDrive file download failed for ${name}`);
    }

    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    const text = await extractTextFromFile(name, buffer);
    const fileUrl = await uploadFile(name, buffer);

    const documentId = await upsertImportedDocument({
      connector,
      itemId,
      fileName: name,
      fileType: fileExtension(name),
      fileUrl,
      sourceUrl,
    });

    await processDocumentRecord(documentId, connector.project_id, text);
    imported++;
  }

  return { imported, provider: 'onedrive', connectorId: connector.id };
}

async function syncGitHubConnector(connector: DocumentConnectorRecord) {
  const config = connector.config as ConnectorConfig;

  if (config.demo) {
    let imported = 0;
    for (const item of SAMPLE_FIXTURES.github) {
      const fileName = item.id.split('/').pop() ?? 'document.md';
      const fileUrl = await uploadFile(fileName, Buffer.from(item.text, 'utf8'));
      const documentId = await upsertImportedDocument({
        connector,
        itemId: item.id,
        fileName,
        fileType: fileExtension(fileName),
        fileUrl,
        sourceUrl: `https://github.com/${String(config.repository ?? 'octocat/Hello-World')}/blob/${String(config.branch ?? 'main')}/${item.id}`,
      });
      await processDocumentRecord(documentId, connector.project_id, item.text);
      imported++;
    }

    return { imported, provider: 'github', connectorId: connector.id, demo: true };
  }

  const repository = asString(config.repository);
  const branch = asString(config.branch, 'main');
  const docsPath = normalizePath(asString(config.docs_path));
  const accessToken = asString(config.access_token);

  if (!/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error('GitHub connector repository must be in owner/repo format');
  }

  const [owner, repo] = repository.split('/');
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const refResponse = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`,
    { headers },
  );

  if (!refResponse.ok) {
    throw new Error(`GitHub branch lookup failed with ${refResponse.status}`);
  }

  const refData = (await refResponse.json()) as { object?: { sha?: string } };
  const branchSha = asString(refData.object?.sha);
  if (!branchSha) {
    throw new Error('GitHub branch SHA not found');
  }

  const treeResponse = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branchSha)}?recursive=1`,
    { headers },
  );

  if (!treeResponse.ok) {
    throw new Error(`GitHub tree request failed with ${treeResponse.status}`);
  }

  const treeData = (await treeResponse.json()) as {
    tree?: Array<{ path?: string; mode?: string; type?: string; sha?: string; size?: number }>;
  };

  const allowedExtensions = new Set(['md', 'mdx', 'txt', 'rst', 'adoc']);
  const items = (treeData.tree ?? [])
    .filter((node) => node.type === 'blob' && Boolean(node.path) && Boolean(node.sha))
    .filter((node) => {
      const path = asString(node.path);
      if (!path) return false;
      if (docsPath && !path.startsWith(`${docsPath}/`) && path !== docsPath) return false;
      const ext = fileExtension(path);
      return allowedExtensions.has(ext);
    })
    .slice(0, 200);

  let imported = 0;

  for (const item of items) {
    const path = asString(item.path);
    const sha = asString(item.sha);
    if (!path || !sha) continue;

    const blobResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${encodeURIComponent(sha)}`,
      { headers },
    );

    if (!blobResponse.ok) {
      throw new Error(`GitHub blob request failed for ${path}`);
    }

    const blobData = (await blobResponse.json()) as { content?: string; encoding?: string };
    if (blobData.encoding !== 'base64') {
      continue;
    }

    const content = Buffer.from(asString(blobData.content).replace(/\n/g, ''), 'base64').toString(
      'utf8',
    );
    const fileName = path.split('/').pop() ?? path;
    const fileUrl = await uploadFile(fileName, Buffer.from(content, 'utf8'));

    const documentId = await upsertImportedDocument({
      connector,
      itemId: path,
      fileName,
      fileType: fileExtension(fileName),
      fileUrl,
      sourceUrl: `https://github.com/${owner}/${repo}/blob/${branch}/${path}`,
    });

    await processDocumentRecord(documentId, connector.project_id, content);
    imported++;
  }

  return { imported, provider: 'github', connectorId: connector.id };
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
    let result;

    if (connector.provider === 'confluence') {
      result = await syncConfluenceConnector(connector);
    } else if (connector.provider === 'sharepoint') {
      result = await syncSharePointConnector(connector);
    } else if (connector.provider === 'jira') {
      result = await syncJiraConnector(connector);
    } else if (connector.provider === 'monday') {
      result = await syncMondayConnector(connector);
    } else if (connector.provider === 'onedrive') {
      result = await syncOneDriveConnector(connector);
    } else {
      result = await syncGitHubConnector(connector);
    }

    await setConnectorSyncState(connector.id, 'success');
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connector sync failed';
    await setConnectorSyncState(connector.id, 'failed', message);
    throw error;
  }
}
