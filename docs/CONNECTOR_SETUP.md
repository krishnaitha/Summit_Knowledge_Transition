# Connector Setup Guide

This guide explains how to configure Document Connectors for:

- Confluence
- SharePoint
- Jira
- Monday.com
- OneDrive
- GitHub

All connectors are configured from:

- `/admin/projects/[id]/documents`
- Section: **Document Connectors**

## Prerequisites

1. You are signed in as an admin.
2. Background worker is running (`npm run worker`) so sync and processing jobs can complete.
3. You have API credentials for the source system.

## Connector Behavior

1. Connector sync pulls source content.
2. Source content is stored as project documents.
3. Imported documents are parsed/chunked and embedded.
4. Imported documents become available for:

- AI chat
- search
- quiz generation

## Sync Schedule

- Manual sync remains available via **Sync now**.
- Automatic sync runs at least once every 24 hours for active connectors (when worker is running).
- Auto-sync only enqueues connectors that are due and do not already have a pending/running sync job.
- Each connector has its own **Enable/Disable auto-sync** toggle in the connector card.

Optional environment variables:

- `CONNECTOR_AUTO_SYNC_INTERVAL_HOURS` (default: `24`)
- `CONNECTOR_AUTO_SYNC_CHECK_MS` (default: `900000` / 15 minutes)

## Confluence Setup

### Required fields

- `Connector name`: Friendly label in admin UI.
- `Confluence base URL`: Example `https://company.atlassian.net/wiki`
- `Space key`: Example `KT`
- `Auth email`: Atlassian account email.
- `API token`: Atlassian API token.

### How to get API token

1. Go to Atlassian API token management.
2. Create a token for your account.
3. Copy token and use it in connector setup.

### Notes

- Uses Confluence REST API (`/rest/api/content`).
- Imports page content as `.txt` documents.

## SharePoint Setup

### Required fields

- `Connector name`
- `SharePoint site URL`: Example `https://tenant.sharepoint.com/sites/Team`
- `Library path`: Example `Shared Documents`
- `Access token`: Bearer token with SharePoint file read access.

### Notes

- Uses SharePoint REST endpoint to list files and download content.
- For DOCX/PDF/TXT/CSV, text extraction runs through the existing document parser.

## Jira Setup

### Required fields

- `Connector name`
- `Jira base URL`: Example `https://company.atlassian.net`
- `Project key`: Example `KT`
- `Auth email`: Atlassian account email.
- `API token`: Atlassian API token.

### Optional fields

- `JQL`: Custom query to filter issues.
- Default behavior uses: `project = <PROJECT_KEY> ORDER BY updated DESC`

### Notes

- Uses Jira REST API (`/rest/api/3/search`).
- Imports issue summary + description into `.txt` documents.
- Description in Atlassian Document Format (ADF) is converted to plain text.

## Monday.com Setup

### Required fields

- `Connector name`
- `Board IDs`: Comma-separated numeric IDs (example: `123456789,987654321`)
- `API token`: Monday API token.

### Optional fields

- `Monday API URL`: Defaults to `https://api.monday.com/v2`
- `Workspace URL`: Example `https://your-workspace.monday.com`

### Notes

- Uses Monday GraphQL API.
- Pulls board items and column values.
- Imports each item as `.txt` document.
- If `Workspace URL` is provided, source links point to board item pages.

## OneDrive Setup

### Required fields

- `Connector name`
- `Drive ID`: Microsoft Graph drive ID.
- `Access token`: Microsoft Graph bearer token.

### Optional fields

- `Folder path`: Example `KT/Runbooks` (defaults to drive root when empty).

### Notes

- Uses Microsoft Graph drive children API.
- Downloads files from the selected drive/folder and processes them as project documents.

## GitHub Setup

### Required fields

- `Connector name`
- `Repository`: `owner/repo` format.

### Optional fields

- `Branch`: Defaults to `main`.
- `Docs path`: Example `docs` to scope imports.
- `Personal access token`: Required for private repositories.

### Notes

- Uses GitHub REST API to read repository tree and file blobs.
- Imports text docs (`.md`, `.mdx`, `.txt`, `.rst`, `.adoc`) as project documents.

## Validation Checklist

After creating a connector:

1. Click **Sync now**.
2. Verify status changes to `running` then `success`.
3. Confirm imported items appear in the documents list.
4. Open a document and verify parsed content looks correct.

## Troubleshooting

### Sync stays in running/idle

- Ensure worker is running in a separate terminal:
  - `npm run worker`
- Check `WORKER_SECRET` alignment between app and worker requests.

### Authentication errors

- Recheck tokens and account permissions.
- For Atlassian connectors, verify email + token pair.
- For Monday, ensure token can read selected boards.
- For OneDrive, ensure token has Graph file read scope and drive access.
- For GitHub, ensure token can read repo contents (especially private repos).

### No content imported

- Verify source filters:
  - Confluence: correct `space_key`
  - Jira: JQL returns issues
  - SharePoint: correct `library_path`
  - Monday: valid numeric `board_ids`
  - OneDrive: valid `drive_id` and folder path
  - GitHub: valid repository, branch, and docs path

### Connector shows failed

- Read `last_sync_error` in connector card.
- Correct config and run **Sync now** again.
