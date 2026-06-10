import 'server-only';

import { Buffer } from 'buffer';

import sql from '@/lib/db';
import { extractTextFromFile } from '@/lib/documents/parse';
import { processDocumentRecord } from '@/lib/documents/process';
import { uploadFile } from '@/lib/storage/local';
import type { DocumentConnectorRecord, Json } from '@/lib/types/database';

type ConnectorConfig = Record<string, unknown>;

export type ConnectorRunMode = 'sync' | 'dry-run' | 'test';

export type ConnectorRunResult = {
  imported: number;
  scanned: number;
  skipped: number;
  skip_reasons: Array<{ reason: string; count: number }>;
  provider: DocumentConnectorRecord['provider'];
  connectorId: string;
  mode: ConnectorRunMode;
  demo?: boolean;
};

export type SyncDocumentConnectorOptions = {
  mode?: ConnectorRunMode;
};

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

function normalizeConfluenceBaseUrl(value: string) {
  const input = value.trim();
  if (!input) {
    return '';
  }

  let url = input;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    let pathname = '';

    if (pathParts[0] === 'wiki') {
      pathname = '/wiki';
    } else if (parsed.hostname.endsWith('atlassian.net')) {
      pathname = '/wiki';
    }

    return trimTrailingSlash(`${parsed.origin}${pathname}`);
  } catch {
    return trimTrailingSlash(input);
  }
}

function normalizeSharePointSiteUrl(value: string) {
  const input = value.trim();
  if (!input) {
    return '';
  }

  let url = input;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const managedPath = pathParts[0];
    let sitePath = '';

    if (
      (managedPath === 'sites' || managedPath === 'teams' || managedPath === 'personal') &&
      pathParts[1]
    ) {
      sitePath = `/${managedPath}/${pathParts[1]}`;
    } else if (pathParts.length > 0 && managedPath !== '_layouts') {
      sitePath = `/${pathParts[0]}`;
    }

    return trimTrailingSlash(`${parsed.origin}${sitePath}`);
  } catch {
    return trimTrailingSlash(input);
  }
}

function normalizeSharePointLibraryPath(libraryPath: string, siteUrl: string) {
  const input = libraryPath.trim();
  if (!input) {
    return '';
  }

  let normalized = input;

  if (/^https?:\/\//i.test(normalized)) {
    try {
      normalized = decodeURIComponent(new URL(normalized).pathname);
    } catch {
      normalized = input;
    }
  }

  normalized = normalized.replace(/\\/g, '/');
  normalized = normalized.split('?')[0] ?? normalized;
  normalized = normalized.split('#')[0] ?? normalized;
  normalized = normalized.replace(/\/Forms\/.*$/i, '');

  const sitePath = (() => {
    try {
      return new URL(siteUrl).pathname;
    } catch {
      return '';
    }
  })();

  const cleanPath = normalizePath(normalized);
  if (!cleanPath) {
    return '';
  }

  const cleanSitePath = normalizePath(sitePath);
  if (!cleanSitePath) {
    return `/${cleanPath}`;
  }

  if (cleanPath.startsWith(`${cleanSitePath}/`) || cleanPath === cleanSitePath) {
    return `/${cleanPath}`;
  }

  return `/${cleanSitePath}/${cleanPath}`;
}

function normalizeOneDriveFolderPath(value: string) {
  const input = value.trim();
  if (!input) {
    return '';
  }

  let cleaned = input;

  if (/^https?:\/\//i.test(cleaned)) {
    try {
      const url = new URL(cleaned);
      const rootPath = url.pathname.match(/\/root:\/(.*?)(?::\/|$)/i);
      if (rootPath?.[1]) {
        cleaned = decodeURIComponent(rootPath[1]);
      } else {
        cleaned = decodeURIComponent(url.pathname);
      }
    } catch {
      cleaned = input;
    }
  }

  cleaned = cleaned.split('?')[0] ?? cleaned;
  cleaned = cleaned.split('#')[0] ?? cleaned;
  cleaned = cleaned.replace(/^root:\//i, '');
  cleaned = cleaned.replace(/:\/?$/, '');

  return normalizePath(cleaned);
}

function normalizeOptionalUrl(value: string) {
  const input = value.trim();
  if (!input) {
    return '';
  }

  let url = input;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    return trimTrailingSlash(`${parsed.origin}${parsed.pathname}`);
  } catch {
    return trimTrailingSlash(input);
  }
}

function normalizeMondayApiUrl(value: string) {
  const normalized = normalizeOptionalUrl(value);
  if (!normalized) {
    return 'https://api.monday.com/v2';
  }

  return normalized.endsWith('/v2') ? normalized : `${normalized}/v2`;
}

function normalizeMondayBoardIds(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/\d+/);
      return match?.[0] ?? '';
    })
    .filter((id) => /^\d+$/.test(id));
}

function incrementReason(reasons: Map<string, number>, reason: string) {
  reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
}

function toSkipReasonSummary(reasons: Map<string, number>) {
  return Array.from(reasons.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function createRunResult(params: {
  connector: DocumentConnectorRecord;
  mode: ConnectorRunMode;
  imported: number;
  scanned: number;
  reasons?: Map<string, number>;
  demo?: boolean;
}): ConnectorRunResult {
  const reasonSummary = toSkipReasonSummary(params.reasons ?? new Map<string, number>());
  const skipped = reasonSummary.reduce((sum, reason) => sum + reason.count, 0);

  return {
    imported: params.imported,
    scanned: params.scanned,
    skipped,
    skip_reasons: reasonSummary,
    provider: params.connector.provider,
    connectorId: params.connector.id,
    mode: params.mode,
    demo: params.demo,
  };
}

async function readErrorSnippet(response: Response) {
  const text = (await response.text()).replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }
  return text.slice(0, 220);
}

function normalizeGitHubRepository(value: string) {
  let repository = value.trim();

  if (!repository) {
    return '';
  }

  repository = repository.replace(/^https?:\/\//i, '');
  repository = repository.replace(/^github\.com\//i, '');
  repository = repository.replace(/\.git$/i, '');
  repository = repository.split('#')[0] ?? repository;
  repository = repository.split('?')[0] ?? repository;
  repository = repository.replace(/^\/+|\/+$/g, '');

  const parts = repository.split('/').filter(Boolean);
  if (parts.length < 2) {
    return repository;
  }

  return `${parts[0]}/${parts[1]}`;
}

function normalizeGitHubBranch(value: string) {
  const branch = value.trim().replace(/^refs\/heads\//, '');
  return branch || 'main';
}

function normalizeGitHubDocsPath(value: string) {
  const input = value.trim();
  if (!input) {
    return '';
  }

  let cleaned = input.split('#')[0] ?? input;
  cleaned = cleaned.split('?')[0] ?? cleaned;
  cleaned = cleaned
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/^(www\.)?github\.com\//i, '')
    .replace(/^\/+/, '');

  const parts = cleaned.split('/').filter(Boolean);

  if (parts.length >= 5 && (parts[2] === 'tree' || parts[2] === 'blob')) {
    return normalizePath(parts.slice(4).join('/'));
  }

  if (parts.length >= 2) {
    return normalizePath(parts.slice(2).join('/'));
  }

  return normalizePath(cleaned);
}

async function fetchGitHubBranchSha(
  owner: string,
  repo: string,
  branch: string,
  headers: Record<string, string>,
) {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`,
    { headers },
  );

  if (!response.ok) {
    return { sha: '', status: response.status };
  }

  const data = (await response.json()) as { object?: { sha?: string } };
  return { sha: asString(data.object?.sha), status: response.status };
}

async function fetchGitHubDefaultBranch(
  owner: string,
  repo: string,
  headers: Record<string, string>,
) {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers },
  );

  if (!response.ok) {
    return { defaultBranch: '', status: response.status };
  }

  const data = (await response.json()) as { default_branch?: string };
  return { defaultBranch: asString(data.default_branch), status: response.status };
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
  summary: Json | null = null,
) {
  try {
    await sql`
      UPDATE document_connectors
      SET last_sync_status = ${status},
          last_sync_error = ${error},
          last_sync_summary = ${summary ? sql.json(summary) : null},
          last_synced_at = ${status === 'success' ? new Date().toISOString() : null},
          updated_at = NOW()
      WHERE id = ${connectorId}
    `;
  } catch {
    await sql`
      UPDATE document_connectors
      SET last_sync_status = ${status},
          last_sync_error = ${error},
          last_synced_at = ${status === 'success' ? new Date().toISOString() : null},
          updated_at = NOW()
      WHERE id = ${connectorId}
    `;
  }
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

async function previewConfluenceConnector(
  connector: DocumentConnectorRecord,
  mode: ConnectorRunMode,
): Promise<ConnectorRunResult> {
  const config = connector.config as ConnectorConfig;

  if (config.demo) {
    return createRunResult({
      connector,
      mode,
      imported: SAMPLE_FIXTURES.confluence.length,
      scanned: SAMPLE_FIXTURES.confluence.length,
      demo: true,
    });
  }

  const baseUrl = normalizeConfluenceBaseUrl(asString(config.base_url));
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
  let scanned = 0;
  let imported = 0;
  let pagesSeen = 0;
  const reasons = new Map<string, number>();

  while (true) {
    const url = new URL(`${baseUrl}/rest/api/content`);
    url.searchParams.set('spaceKey', spaceKey);
    url.searchParams.set('expand', '_links');
    url.searchParams.set('limit', mode === 'test' ? '10' : '25');
    url.searchParams.set('start', String(start));

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const details = await readErrorSnippet(response);
      throw new Error(
        `Confluence request failed with ${response.status}${details ? `: ${details}` : ''}`,
      );
    }

    const data = (await response.json()) as {
      results?: Array<Record<string, unknown>>;
      size?: number;
      total?: number;
    };

    const items = data.results ?? [];
    if (!items.length) {
      break;
    }

    for (const item of items) {
      scanned++;
      const itemId = asString(item.id);
      if (!itemId) {
        incrementReason(reasons, 'missing Confluence page id');
        continue;
      }
      imported++;

      if (mode === 'test') {
        return createRunResult({ connector, mode, imported, scanned, reasons });
      }
    }

    pagesSeen += items.length;
    const total = typeof data.total === 'number' ? data.total : pagesSeen;
    start += data.size ?? items.length;
    if (pagesSeen >= total) {
      break;
    }
  }

  if (imported === 0) {
    throw new Error(`Confluence sync found 0 pages for space key ${spaceKey}`);
  }

  return createRunResult({ connector, mode, imported, scanned, reasons });
}

async function previewSharePointConnector(
  connector: DocumentConnectorRecord,
  mode: ConnectorRunMode,
): Promise<ConnectorRunResult> {
  const config = connector.config as ConnectorConfig;

  if (config.demo) {
    return createRunResult({
      connector,
      mode,
      imported: SAMPLE_FIXTURES.sharepoint.length,
      scanned: SAMPLE_FIXTURES.sharepoint.length,
      demo: true,
    });
  }

  const siteUrl = normalizeSharePointSiteUrl(asString(config.site_url));
  const libraryPath = normalizeSharePointLibraryPath(
    asString(config.library_path) || 'Shared Documents',
    siteUrl,
  );
  const accessToken = asString(config.access_token);

  if (!siteUrl || !libraryPath || !accessToken) {
    throw new Error('SharePoint connector is missing site URL, library path, or access token');
  }

  const initialListUrl = new URL(
    `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${libraryPath.replace(/'/g, "''")}')/Files`,
  );
  initialListUrl.searchParams.set('$select', 'Name,ServerRelativeUrl,UniqueId');
  initialListUrl.searchParams.set('$top', mode === 'test' ? '20' : '200');

  const headers = {
    Accept: 'application/json;odata=nometadata',
    Authorization: `Bearer ${accessToken}`,
  };

  const reasons = new Map<string, number>();
  let scanned = 0;
  let imported = 0;
  let nextListUrl = initialListUrl.toString();

  while (nextListUrl) {
    const response = await fetch(nextListUrl, { headers });

    if (!response.ok) {
      const details = await readErrorSnippet(response);
      throw new Error(
        `SharePoint request failed with ${response.status}${details ? `: ${details}` : ''}`,
      );
    }

    const data = (await response.json()) as {
      value?: Array<Record<string, unknown>>;
      '@odata.nextLink'?: unknown;
    };

    const items = data.value ?? [];

    for (const item of items) {
      scanned++;
      const itemId = asString(item.UniqueId ?? item.ServerRelativeUrl ?? '');
      const serverRelativeUrl = asString(item.ServerRelativeUrl ?? '');

      if (!itemId) {
        incrementReason(reasons, 'missing SharePoint item id');
        continue;
      }

      if (!serverRelativeUrl) {
        incrementReason(reasons, 'missing SharePoint server-relative URL');
        continue;
      }

      imported++;

      if (mode === 'test') {
        return createRunResult({ connector, mode, imported, scanned, reasons });
      }
    }

    nextListUrl = mode === 'test' ? '' : asString(data['@odata.nextLink']);
  }

  if (imported === 0) {
    throw new Error(
      `SharePoint sync found 0 files in ${libraryPath}. Check library path format and token permissions.`,
    );
  }

  return createRunResult({ connector, mode, imported, scanned, reasons });
}

async function previewJiraConnector(
  connector: DocumentConnectorRecord,
  mode: ConnectorRunMode,
): Promise<ConnectorRunResult> {
  const config = connector.config as ConnectorConfig;

  if (config.demo) {
    return createRunResult({
      connector,
      mode,
      imported: SAMPLE_FIXTURES.jira.length,
      scanned: SAMPLE_FIXTURES.jira.length,
      demo: true,
    });
  }

  const baseUrl = trimTrailingSlash(asString(config.base_url));
  const projectKey = asString(config.project_key).toUpperCase();
  const authEmail = asString(config.auth_email);
  const accessToken = asString(config.access_token);
  const jql = stripJqlQuotes(asString(config.jql, `project = ${projectKey} ORDER BY updated DESC`));

  if (!baseUrl || !projectKey || !authEmail || !accessToken) {
    throw new Error('Jira connector is missing base URL, project key, email, or API token');
  }

  const searchUrl = new URL(`${baseUrl}/rest/api/3/search`);
  searchUrl.searchParams.set('jql', jql);
  searchUrl.searchParams.set('startAt', '0');
  searchUrl.searchParams.set('maxResults', mode === 'test' ? '5' : '50');
  searchUrl.searchParams.set('fields', 'summary');

  const response = await fetch(searchUrl, {
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${authEmail}:${accessToken}`).toString('base64')}`,
    },
  });

  if (!response.ok) {
    const details = await readErrorSnippet(response);
    throw new Error(`Jira request failed with ${response.status}${details ? `: ${details}` : ''}`);
  }

  const data = (await response.json()) as {
    issues?: Array<Record<string, unknown>>;
  };

  const reasons = new Map<string, number>();
  let scanned = 0;
  let imported = 0;

  for (const issue of data.issues ?? []) {
    scanned++;
    const issueId = asString(issue.id) || asString(issue.key);
    if (!issueId) {
      incrementReason(reasons, 'missing Jira issue id');
      continue;
    }

    imported++;
    if (mode === 'test') {
      return createRunResult({ connector, mode, imported, scanned, reasons });
    }
  }

  if (imported === 0) {
    throw new Error(`Jira sync found 0 issues for project key ${projectKey}`);
  }

  return createRunResult({ connector, mode, imported, scanned, reasons });
}

async function previewMondayConnector(
  connector: DocumentConnectorRecord,
  mode: ConnectorRunMode,
): Promise<ConnectorRunResult> {
  const config = connector.config as ConnectorConfig;

  if (config.demo) {
    return createRunResult({
      connector,
      mode,
      imported: SAMPLE_FIXTURES.monday.length,
      scanned: SAMPLE_FIXTURES.monday.length,
      demo: true,
    });
  }

  const apiUrl = normalizeMondayApiUrl(asString(config.api_url));
  const boardIdsRaw = asString(config.board_ids);
  const accessToken = asString(config.access_token);

  if (!boardIdsRaw || !accessToken) {
    throw new Error('Monday connector is missing board IDs or API token');
  }

  const boardIds = normalizeMondayBoardIds(boardIdsRaw);
  if (!boardIds.length) {
    throw new Error('Monday board IDs must be a comma-separated list of numeric board IDs');
  }

  const query = `
    query FetchBoards($boardIds: [ID!]!) {
      boards(ids: $boardIds) {
        id
        items_page(limit: 100) {
          items {
            id
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
    const details = await readErrorSnippet(response);
    throw new Error(
      `Monday request failed with ${response.status}${details ? `: ${details}` : ''}`,
    );
  }

  const data = (await response.json()) as {
    data?: {
      boards?: Array<{
        items_page?: {
          items?: Array<{ id?: string }>;
        };
      }>;
    };
    errors?: Array<{ message?: string }>;
  };

  if (data.errors?.length) {
    throw new Error(asString(data.errors[0]?.message, 'Monday GraphQL request failed'));
  }

  const boards = data.data?.boards ?? [];
  if (!boards.length) {
    throw new Error(`Monday sync found 0 boards for IDs: ${boardIds.join(', ')}`);
  }

  const reasons = new Map<string, number>();
  let scanned = 0;
  let imported = 0;

  for (const board of boards) {
    const items = board.items_page?.items ?? [];

    for (const item of items) {
      scanned++;
      const itemId = asString(item.id);
      if (!itemId) {
        incrementReason(reasons, 'missing Monday item id');
        continue;
      }

      imported++;
      if (mode === 'test') {
        return createRunResult({ connector, mode, imported, scanned, reasons });
      }
    }
  }

  if (imported === 0) {
    throw new Error('Monday sync found 0 items to import for the configured boards');
  }

  return createRunResult({ connector, mode, imported, scanned, reasons });
}

async function previewOneDriveConnector(
  connector: DocumentConnectorRecord,
  mode: ConnectorRunMode,
): Promise<ConnectorRunResult> {
  const config = connector.config as ConnectorConfig;

  if (config.demo) {
    return createRunResult({
      connector,
      mode,
      imported: SAMPLE_FIXTURES.onedrive.length,
      scanned: SAMPLE_FIXTURES.onedrive.length,
      demo: true,
    });
  }

  const driveId = asString(config.drive_id);
  const folderPath = normalizeOneDriveFolderPath(asString(config.folder_path));
  const accessToken = asString(config.access_token);

  if (!driveId || !accessToken) {
    throw new Error('OneDrive connector is missing drive ID or access token');
  }

  const listEndpoint = folderPath
    ? `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encodePathSegments(folderPath)}:/children?$top=200`
    : `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root/children?$top=200`;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };

  const reasons = new Map<string, number>();
  let scanned = 0;
  let imported = 0;
  let nextListUrl = listEndpoint;

  while (nextListUrl) {
    const response = await fetch(nextListUrl, { headers });

    if (!response.ok) {
      const details = await readErrorSnippet(response);
      throw new Error(
        `OneDrive request failed with ${response.status}${details ? `: ${details}` : ''}`,
      );
    }

    const data = (await response.json()) as {
      value?: Array<{
        id?: string;
        file?: Record<string, unknown>;
        ['@microsoft.graph.downloadUrl']?: string;
      }>;
      ['@odata.nextLink']?: unknown;
    };

    for (const item of data.value ?? []) {
      if (!item.file) {
        incrementReason(reasons, 'folder or non-file item');
        continue;
      }

      scanned++;

      const itemId = asString(item.id);
      const downloadUrl = asString(item['@microsoft.graph.downloadUrl']);

      if (!itemId) {
        incrementReason(reasons, 'missing OneDrive item id');
        continue;
      }

      if (!downloadUrl) {
        incrementReason(reasons, 'missing OneDrive download URL');
        continue;
      }

      imported++;
      if (mode === 'test') {
        return createRunResult({ connector, mode, imported, scanned, reasons });
      }
    }

    nextListUrl = mode === 'test' ? '' : asString(data['@odata.nextLink']);
  }

  if (imported === 0) {
    const scope = folderPath ? ` in folder ${folderPath}` : '';
    throw new Error(
      `OneDrive sync found 0 files${scope}. Check folder path and token permissions.`,
    );
  }

  return createRunResult({ connector, mode, imported, scanned, reasons });
}

async function previewGitHubConnector(
  connector: DocumentConnectorRecord,
  mode: ConnectorRunMode,
): Promise<ConnectorRunResult> {
  const config = connector.config as ConnectorConfig;

  if (config.demo) {
    return createRunResult({
      connector,
      mode,
      imported: SAMPLE_FIXTURES.github.length,
      scanned: SAMPLE_FIXTURES.github.length,
      demo: true,
    });
  }

  const repository = normalizeGitHubRepository(asString(config.repository));
  let branch = normalizeGitHubBranch(asString(config.branch));
  const docsPath = normalizeGitHubDocsPath(asString(config.docs_path));
  const accessToken = asString(config.access_token);

  if (!/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error(
      'GitHub connector repository must be owner/repo (or a full GitHub URL like https://github.com/owner/repo)',
    );
  }

  const [owner, repo] = repository.split('/');
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let { sha: branchSha, status: branchLookupStatus } = await fetchGitHubBranchSha(
    owner,
    repo,
    branch,
    headers,
  );

  if (!branchSha) {
    const { defaultBranch } = await fetchGitHubDefaultBranch(owner, repo, headers);
    if (defaultBranch && defaultBranch !== branch) {
      const fallbackLookup = await fetchGitHubBranchSha(owner, repo, defaultBranch, headers);
      if (fallbackLookup.sha) {
        branch = defaultBranch;
        branchSha = fallbackLookup.sha;
        branchLookupStatus = fallbackLookup.status;
      }
    }
  }

  if (!branchSha) {
    throw new Error(
      `GitHub branch lookup failed with ${branchLookupStatus} for ${owner}/${repo}@${branch}. Check repository, branch, and PAT permissions.`,
    );
  }

  const treeResponse = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branchSha)}?recursive=1`,
    { headers },
  );

  if (!treeResponse.ok) {
    throw new Error(`GitHub tree request failed with ${treeResponse.status}`);
  }

  const treeData = (await treeResponse.json()) as {
    tree?: Array<{ path?: string; type?: string; sha?: string }>;
  };

  const allowedExtensions = new Set([
    'md',
    'mdx',
    'txt',
    'rst',
    'adoc',
    'pdf',
    'docx',
    'csv',
    'xlsx',
    'ppt',
    'pptx',
  ]);

  const reasons = new Map<string, number>();
  let scanned = 0;
  let imported = 0;

  for (const node of treeData.tree ?? []) {
    if (node.type !== 'blob') {
      continue;
    }

    scanned++;
    const path = asString(node.path);
    const sha = asString(node.sha);
    if (!path || !sha) {
      incrementReason(reasons, 'missing path or blob SHA');
      continue;
    }

    if (docsPath && !path.startsWith(`${docsPath}/`) && path !== docsPath) {
      incrementReason(reasons, 'outside selected docs path');
      continue;
    }

    const ext = fileExtension(path);
    if (!allowedExtensions.has(ext)) {
      incrementReason(reasons, 'unsupported extension');
      continue;
    }

    imported++;
    if (mode === 'test') {
      return createRunResult({ connector, mode, imported, scanned, reasons });
    }
  }

  if (imported === 0) {
    const scope = docsPath ? ` under path "${docsPath}"` : '';
    throw new Error(
      `GitHub sync found 0 supported files${scope}. Supported extensions: ${Array.from(allowedExtensions).join(', ')}`,
    );
  }

  return createRunResult({ connector, mode, imported, scanned, reasons });
}

async function previewConnector(
  connector: DocumentConnectorRecord,
  mode: Exclude<ConnectorRunMode, 'sync'>,
): Promise<ConnectorRunResult> {
  if (connector.provider === 'confluence') {
    return previewConfluenceConnector(connector, mode);
  }

  if (connector.provider === 'sharepoint') {
    return previewSharePointConnector(connector, mode);
  }

  if (connector.provider === 'jira') {
    return previewJiraConnector(connector, mode);
  }

  if (connector.provider === 'monday') {
    return previewMondayConnector(connector, mode);
  }

  if (connector.provider === 'onedrive') {
    return previewOneDriveConnector(connector, mode);
  }

  return previewGitHubConnector(connector, mode);
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

  const baseUrl = normalizeConfluenceBaseUrl(asString(config.base_url));
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
      const details = await readErrorSnippet(response);
      throw new Error(
        `Confluence request failed with ${response.status}${details ? `: ${details}` : ''}`,
      );
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

  if (imported === 0) {
    throw new Error(`Confluence sync found 0 pages for space key ${spaceKey}`);
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

  const siteUrl = normalizeSharePointSiteUrl(asString(config.site_url));
  const libraryPath = normalizeSharePointLibraryPath(
    asString(config.library_path) || 'Shared Documents',
    siteUrl,
  );
  const accessToken = asString(config.access_token);

  if (!siteUrl || !libraryPath || !accessToken) {
    throw new Error('SharePoint connector is missing site URL, library path, or access token');
  }

  const initialListUrl = new URL(
    `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${libraryPath.replace(/'/g, "''")}')/Files`,
  );
  initialListUrl.searchParams.set('$select', 'Name,ServerRelativeUrl,TimeLastModified,UniqueId');
  initialListUrl.searchParams.set('$top', '200');

  const headers = {
    Accept: 'application/json;odata=nometadata',
    Authorization: `Bearer ${accessToken}`,
  };

  const items: Array<Record<string, unknown>> = [];
  let nextListUrl = initialListUrl.toString();

  while (nextListUrl) {
    const response = await fetch(nextListUrl, { headers });

    if (!response.ok) {
      const details = await readErrorSnippet(response);
      throw new Error(
        `SharePoint request failed with ${response.status}${details ? `: ${details}` : ''}`,
      );
    }

    const data = (await response.json()) as {
      value?: Array<Record<string, unknown>>;
      '@odata.nextLink'?: unknown;
    };

    items.push(...(data.value ?? []));
    nextListUrl = asString(data['@odata.nextLink']);
  }

  if (items.length === 0) {
    throw new Error(
      `SharePoint sync found 0 files in ${libraryPath}. Check library path format and token permissions.`,
    );
  }

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
      const details = await readErrorSnippet(fileResponse);
      throw new Error(
        `SharePoint file download failed for ${name} with ${fileResponse.status}${details ? `: ${details}` : ''}`,
      );
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

  if (imported === 0) {
    throw new Error(
      `SharePoint sync found 0 importable files in ${libraryPath}. Verify file formats and access permissions.`,
    );
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

  const apiUrl = normalizeMondayApiUrl(asString(config.api_url));
  const workspaceUrl = normalizeOptionalUrl(asString(config.workspace_url));
  const boardIdsRaw = asString(config.board_ids);
  const accessToken = asString(config.access_token);

  if (!boardIdsRaw || !accessToken) {
    throw new Error('Monday connector is missing board IDs or API token');
  }

  const boardIds = normalizeMondayBoardIds(boardIdsRaw);

  if (!boardIds.length) {
    throw new Error('Monday board IDs must be a comma-separated list of numeric board IDs');
  }

  const itemFields = `
    id
    name
    updated_at
    column_values {
      id
      text
      type
    }
  `;

  const requestMonday = async (query: string, variables: Record<string, unknown>) => {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const details = await readErrorSnippet(response);
      throw new Error(
        `Monday request failed with ${response.status}${details ? `: ${details}` : ''}`,
      );
    }

    return (await response.json()) as {
      data?: {
        boards?: Array<{
          id?: string;
          name?: string;
          items_page?: {
            cursor?: string;
            items?: Array<{
              id?: string;
              name?: string;
              updated_at?: string;
              column_values?: Array<{ id?: string; text?: string; type?: string }>;
            }>;
          };
        }>;
        next_items_page?: {
          cursor?: string;
          items?: Array<{
            id?: string;
            name?: string;
            updated_at?: string;
            column_values?: Array<{ id?: string; text?: string; type?: string }>;
          }>;
        };
      };
      errors?: Array<{ message?: string }>;
    };
  };

  const fetchBoardsQuery = `
    query FetchBoards($boardIds: [ID!]!) {
      boards(ids: $boardIds) {
        id
        name
        items_page(limit: 100) {
          cursor
          items {
            ${itemFields}
          }
        }
      }
    }
  `;

  const boardsResponse = await requestMonday(fetchBoardsQuery, { boardIds });
  if (boardsResponse.errors?.length) {
    const message = asString(boardsResponse.errors[0]?.message, 'Monday GraphQL request failed');
    throw new Error(message);
  }

  const boards = boardsResponse.data?.boards ?? [];
  if (!boards.length) {
    throw new Error(`Monday sync found 0 boards for IDs: ${boardIds.join(', ')}`);
  }

  const fetchNextItemsQuery = `
    query NextItemsPage($cursor: String!) {
      next_items_page(cursor: $cursor, limit: 100) {
        cursor
        items {
          ${itemFields}
        }
      }
    }
  `;

  let imported = 0;

  for (const board of boards) {
    const boardId = asString(board.id);
    const boardName = asString(board.name, 'Board');
    const boardItems: Array<{
      id?: string;
      name?: string;
      updated_at?: string;
      column_values?: Array<{ id?: string; text?: string; type?: string }>;
    }> = [...(board.items_page?.items ?? [])];

    let cursor = asString(board.items_page?.cursor);
    let pageSafety = 0;

    while (cursor && pageSafety < 1000) {
      const nextPageResponse = await requestMonday(fetchNextItemsQuery, { cursor });
      if (nextPageResponse.errors?.length) {
        const message = asString(
          nextPageResponse.errors[0]?.message,
          'Monday items pagination request failed',
        );
        throw new Error(message);
      }

      const nextPage = nextPageResponse.data?.next_items_page;
      boardItems.push(...(nextPage?.items ?? []));
      cursor = asString(nextPage?.cursor);
      pageSafety++;
    }

    if (pageSafety >= 1000) {
      throw new Error(`Monday pagination exceeded safety limit for board ${boardId || boardName}`);
    }

    for (const item of boardItems) {
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

  if (imported === 0) {
    throw new Error('Monday sync found 0 items to import for the configured boards');
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
  const folderPath = normalizeOneDriveFolderPath(asString(config.folder_path));
  const accessToken = asString(config.access_token);

  if (!driveId || !accessToken) {
    throw new Error('OneDrive connector is missing drive ID or access token');
  }

  const listEndpoint = folderPath
    ? `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encodePathSegments(folderPath)}:/children?$top=200`
    : `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root/children?$top=200`;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };

  const items: Array<{
    id?: string;
    name?: string;
    webUrl?: string;
    file?: Record<string, unknown>;
    ['@microsoft.graph.downloadUrl']?: string;
  }> = [];

  let nextListUrl = listEndpoint;
  while (nextListUrl) {
    const response = await fetch(nextListUrl, { headers });

    if (!response.ok) {
      const details = await readErrorSnippet(response);
      throw new Error(
        `OneDrive request failed with ${response.status}${details ? `: ${details}` : ''}`,
      );
    }

    const data = (await response.json()) as {
      value?: Array<{
        id?: string;
        name?: string;
        webUrl?: string;
        file?: Record<string, unknown>;
        ['@microsoft.graph.downloadUrl']?: string;
      }>;
      ['@odata.nextLink']?: unknown;
    };

    items.push(...(data.value ?? []));
    nextListUrl = asString(data['@odata.nextLink']);
  }

  if (items.length === 0) {
    const scope = folderPath ? ` in folder ${folderPath}` : '';
    throw new Error(
      `OneDrive sync found 0 files${scope}. Check folder path and token permissions.`,
    );
  }

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
      const details = await readErrorSnippet(fileResponse);
      throw new Error(
        `OneDrive file download failed for ${name} with ${fileResponse.status}${details ? `: ${details}` : ''}`,
      );
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

  if (imported === 0) {
    throw new Error('OneDrive sync found 0 importable files for the configured drive/folder');
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

  const repository = normalizeGitHubRepository(asString(config.repository));
  let branch = normalizeGitHubBranch(asString(config.branch));
  const docsPath = normalizeGitHubDocsPath(asString(config.docs_path));
  const accessToken = asString(config.access_token);

  if (!/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error(
      'GitHub connector repository must be owner/repo (or a full GitHub URL like https://github.com/owner/repo)',
    );
  }

  const [owner, repo] = repository.split('/');
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let { sha: branchSha, status: branchLookupStatus } = await fetchGitHubBranchSha(
    owner,
    repo,
    branch,
    headers,
  );

  if (!branchSha) {
    const { defaultBranch } = await fetchGitHubDefaultBranch(owner, repo, headers);
    if (defaultBranch && defaultBranch !== branch) {
      const fallbackLookup = await fetchGitHubBranchSha(owner, repo, defaultBranch, headers);
      if (fallbackLookup.sha) {
        branch = defaultBranch;
        branchSha = fallbackLookup.sha;
        branchLookupStatus = fallbackLookup.status;
      }
    }
  }

  if (!branchSha) {
    throw new Error(
      `GitHub branch lookup failed with ${branchLookupStatus} for ${owner}/${repo}@${branch}. Check repository, branch, and PAT permissions.`,
    );
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

  const allowedExtensions = new Set([
    'md',
    'mdx',
    'txt',
    'rst',
    'adoc',
    'pdf',
    'docx',
    'csv',
    'xlsx',
    'ppt',
    'pptx',
  ]);
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

  if (items.length === 0) {
    const scope = docsPath ? ` under path "${docsPath}"` : '';
    throw new Error(
      `GitHub sync found 0 supported files${scope}. Supported extensions: ${Array.from(allowedExtensions).join(', ')}`,
    );
  }

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

    const fileBuffer = Buffer.from(asString(blobData.content).replace(/\n/g, ''), 'base64');
    const fileName = path.split('/').pop() ?? path;
    const content = await extractTextFromFile(fileName, fileBuffer);
    const fileUrl = await uploadFile(fileName, fileBuffer);

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

export async function syncDocumentConnector(
  connectorId: string,
  options: SyncDocumentConnectorOptions = {},
) {
  const rows = await sql<DocumentConnectorRecord[]>`
    SELECT * FROM document_connectors WHERE id = ${connectorId} LIMIT 1
  `;
  const connector = rows[0] ?? null;
  const mode = options.mode ?? 'sync';

  if (!connector) {
    throw new Error('Connector not found');
  }

  await setConnectorSyncState(connector.id, 'running', null, {
    mode,
    status: 'running',
  });

  try {
    let result: ConnectorRunResult;

    if (mode !== 'sync') {
      result = await previewConnector(connector, mode);
    } else {
      const syncResult =
        connector.provider === 'confluence'
          ? await syncConfluenceConnector(connector)
          : connector.provider === 'sharepoint'
            ? await syncSharePointConnector(connector)
            : connector.provider === 'jira'
              ? await syncJiraConnector(connector)
              : connector.provider === 'monday'
                ? await syncMondayConnector(connector)
                : connector.provider === 'onedrive'
                  ? await syncOneDriveConnector(connector)
                  : await syncGitHubConnector(connector);

      result = createRunResult({
        connector,
        mode,
        imported: syncResult.imported,
        scanned: syncResult.imported,
      });
    }

    await setConnectorSyncState(connector.id, 'success', null, {
      ...result,
      completed_at: new Date().toISOString(),
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connector sync failed';
    await setConnectorSyncState(connector.id, 'failed', message, {
      mode,
      status: 'failed',
      message,
      completed_at: new Date().toISOString(),
    });
    throw error;
  }
}
