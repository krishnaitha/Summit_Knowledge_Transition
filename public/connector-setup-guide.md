# Connector Setup Guide

Use this guide to configure Document Connectors in Summit KT.

## Where to configure connectors

1. Go to Admin.
2. Open Projects.
3. Open your project.
4. Open Documents.
5. In Document Connectors, choose a source and submit details.

## Before you start

1. Sign in as an admin.
2. Keep the app server running.
3. Keep the worker running in a separate terminal: npm run worker.
4. Collect API credentials for the source system.

## Confluence

### Connector form fields

1. Source type: Confluence.
2. Connector name.
3. Confluence base URL (example: https://company.atlassian.net/wiki).
4. Space key (example: KT).
5. Auth email.
6. API token.

### How to fetch Confluence auth token

1. Sign in to Atlassian with the account that has Confluence space access.
2. Open: https://id.atlassian.com/manage-profile/security/api-tokens
3. Click Create API token.
4. Enter a token label (example: Summit KT Confluence).
5. Copy the token and store it securely.
6. Use your Atlassian email in Auth email.
7. Paste the token into API token.

### Finish setup

1. Click Connect source.
2. Click Sync now.

## SharePoint

### Connector form fields

1. Source type: SharePoint.
2. Connector name.
3. SharePoint site URL.
4. Library path (example: Shared Documents).
5. Access token.

### How to fetch SharePoint access token

1. Sign in to Azure portal.
2. Open Microsoft Entra ID.
3. Go to App registrations and create/select an app.
4. In API permissions, add Microsoft Graph permissions for SharePoint read access.
5. Grant admin consent if required.
6. In Certificates and secrets, create a client secret.
7. Request an OAuth 2.0 access token from Microsoft identity platform using tenant ID, client ID, and client secret.
8. Use the returned bearer token in Access token.

### Finish setup

1. Click Connect source.
2. Click Sync now.

## Jira

### Connector form fields

1. Source type: Jira.
2. Connector name.
3. Jira base URL (example: https://company.atlassian.net).
4. Project key (example: KT).
5. Auth email.
6. API token.
7. Optional JQL.

### How to fetch Jira auth token

1. Sign in to Atlassian with Jira project access.
2. Open: https://id.atlassian.com/manage-profile/security/api-tokens
3. Click Create API token.
4. Enter a token label (example: Summit KT Jira).
5. Copy and store the token.
6. Use your Atlassian email in Auth email.
7. Paste the token into API token.

### Finish setup

1. Click Connect source.
2. Click Sync now.

## Monday.com

### Connector form fields

1. Source type: Monday.com.
2. Connector name.
3. Board IDs as comma-separated numeric IDs.
4. API token.
5. Optional API URL and Workspace URL.

### How to fetch Monday board IDs

1. Open a board in Monday.com.
2. Check the URL and copy the numeric value after /boards/.
3. Repeat for each board you want to sync.
4. Enter IDs as comma-separated values, for example: 123456789,987654321.

Alternative method:

1. Use Monday API Playground.
2. Run a boards query and copy returned board id values.

### How to fetch Monday API token

1. Sign in to Monday.com with access to target boards.
2. Open profile menu and go to Developers (or Admin/Developer settings, based on plan).
3. Create a personal API token or app token.
4. Copy the token and store it securely.
5. Paste it into API token.

### Finish setup

1. Click Connect source.
2. Click Sync now.

## OneDrive

### Connector form fields

1. Source type: OneDrive.
2. Connector name.
3. Drive ID.
4. Folder path (optional).
5. Access token.

### How to fetch OneDrive drive ID

1. Sign in to Microsoft Graph Explorer with a user that can access OneDrive content.
2. Run `GET /me/drive` (or `GET /drives` for shared drives).
3. Copy the `id` value and use it as Drive ID.

### How to fetch OneDrive access token

1. Create or select a Microsoft Entra app registration.
2. Add Microsoft Graph permissions for OneDrive read access (for example `Files.Read.All`).
3. Grant admin consent if required by your tenant.
4. Create a client secret.
5. Request an OAuth bearer token from Microsoft identity platform.
6. Paste the token into Access token.

### Finish setup

1. Click Connect source.
2. Click Sync now.

## GitHub

### Connector form fields

1. Source type: GitHub.
2. Connector name.
3. Repository in `owner/repo` format.
4. Branch (optional, default `main`).
5. Docs path (optional, example `docs`).
6. Personal access token (optional for public repos, required for private repos).

### How to fetch GitHub repository and branch

1. Open the target GitHub repository in browser.
2. Copy `owner/repo` from the URL (for example `acme/kt-docs`).
3. Copy the branch name from the branch selector (for example `main`).

### How to fetch GitHub access token

1. In GitHub, open Settings.
2. Go to Developer settings.
3. Open Personal access tokens.
4. Create a fine-grained token with read-only repository contents access.
5. Copy token and store it securely.
6. Paste it into Personal access token.

### Finish setup

1. Click Connect source.
2. Click Sync now.

## Verify successful sync

1. Connector status changes from running to success.
2. Imported items appear in the documents list.
3. Open an imported document and verify extracted text.
4. Validate search, chat, or quiz generation using imported data.

## Troubleshooting

### Connector stuck in running

1. Ensure worker is running.
2. Check WORKER_SECRET if enabled.

### Authentication errors

1. Confirm token is valid and not expired.
2. Confirm token has required permissions.
3. Atlassian connectors: verify email and token pair.
4. Monday: verify token owner can access listed boards.
5. OneDrive: verify token has Graph file read scope and drive access.
6. GitHub: verify token can read repository contents.

### No items imported

1. Confluence: verify base URL and space key.
2. SharePoint: verify site URL and library path.
3. Jira: verify project key and JQL.
4. Monday: verify board IDs are numeric and accessible.
5. OneDrive: verify drive ID and optional folder path.
6. GitHub: verify repository format, branch, and docs path.
