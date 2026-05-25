# NexTElevate Release Notes - May 2026

This document summarizes the recent product and engineering updates delivered in May 2026.

## Chat Experience

- Added in-app memory helper text in chat input area with command examples:
  - `remember key: value`
  - `yes remember` / `no remember`
- Added starter prompt chips above the chat input.
- Added response controls:
  - Default
  - Concise
  - Step-by-step
  - Bullet list
  - With citations only
  - Clarify first
- Added explicit answer pinning UX (`Pin this answer` / `Pinned`).
- Added per-session lifecycle actions:
  - Auto title generation for new sessions
  - Rename session
  - Delete session
  - Export as Markdown
  - Export as print-ready PDF view
- Added timestamp display on chat messages.
- Improved structured markdown rendering for assistant output, including better handling for:
  - Checklist sections
  - Timelines
  - Risk matrix content
  - Dependency-map style content
  - Tables and long list blocks

## Chat Performance and Navigation Reliability

- Reduced chat route entry blocking by moving session/history hydration to client-side loading.
- Added route loading skeletons for chat pages (admin and member) to improve perceived responsiveness.
- Fixed invalid nested interactive patterns (link/button nesting) in multiple screens to prevent unreliable clicks.
- Resolved a route race on admin project pages where debounced document-search URL updates could interfere with chat navigation clicks.
- Changed chat history behavior to keep initial page load cleaner:
  - Previous sessions are now loaded on demand via `Load previous sessions`.

## Memory and Stability Fixes

- Fixed member memory page runtime crash caused by non-numeric confidence values (`toFixed` on non-number).

## Document Connectors

- Added automatic connector synchronization support:
  - Daily auto-sync window by default (24 hours)
  - Background worker periodically enqueues due connector-sync jobs
  - Duplicate pending/running sync jobs are prevented
- Added per-connector auto-sync toggle (`Enable auto-sync` / `Disable auto-sync`).
- Manual `Sync now` remains available regardless of toggle state.
- Added connector card and setup-guide messaging clarifying auto-sync timing and behavior.
- Added migration:
  - `033_connector_auto_sync_toggle.sql`

### Auto-sync tuning environment variables

- `CONNECTOR_AUTO_SYNC_INTERVAL_HOURS` (default: `24`)
- `CONNECTOR_AUTO_SYNC_CHECK_MS` (default: `900000`, every 15 minutes)

## Documents UX

- Added hover preview for uploaded documents in the documents list:
  - Hovering document name shows a short preview excerpt from the first indexed chunk.

## Observability UX

- Added pagination to these observability tables:
  - Top unanswered queries
  - Possible hallucinations

## API and Schema Surface Updates

- Added runtime schema protections around chat session title usage where needed.
- Added session-management and export endpoints for chat workflows.
- Updated document and connector data handling to support preview excerpts and per-connector auto-sync settings.

## Developer Validation

All above changes were validated with:

- `npm run typecheck`
- `npm run lint`
