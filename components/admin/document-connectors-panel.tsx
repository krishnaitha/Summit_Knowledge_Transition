'use client';

import { useState } from 'react';
import { Link2, RefreshCcw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubmitButton } from '@/components/ui/submit-button';
import type { DocumentConnectorRecord } from '@/lib/types/database';
import { cn } from '@/lib/utils';

type ConnectorAction = (formData: FormData) => Promise<void>;

type Props = {
  projectId: string;
  connectors: DocumentConnectorRecord[];
  createAction: ConnectorAction;
  syncAction: ConnectorAction;
  deleteAction: ConnectorAction;
};

export function DocumentConnectorsPanel({
  projectId,
  connectors,
  createAction,
  syncAction,
  deleteAction,
}: Props) {
  const [provider, setProvider] = useState<
    'confluence' | 'sharepoint' | 'jira' | 'monday' | 'onedrive' | 'github'
  >('confluence');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Link2 className="text-brand-600 h-4 w-4" />
          <CardTitle>Document connectors</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
          <p className="text-sm font-semibold text-slate-900">Need help setting up connectors?</p>
          <p className="mt-1 text-xs text-slate-600">
            Use the step-by-step setup guide for Confluence, SharePoint, Jira, Monday, OneDrive, and
            GitHub.
          </p>
          <div className="mt-3">
            <a
              href="/connector-setup-guide.md"
              download="connector-setup-guide.md"
              className="inline-flex items-center rounded-xl bg-white px-3 py-2 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-100"
            >
              Download connector setup guide
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
          <p className="text-sm font-semibold text-slate-900">Try a sample connection</p>
          <p className="mt-1 text-xs text-slate-500">
            Use these demo presets to test the import flow without real credentials.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={createAction}>
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="provider" value="confluence" />
              <input type="hidden" name="name" value="Sample Confluence connector" />
              <input type="hidden" name="demo" value="true" />
              <SubmitButton variant="secondary" loadingText="Adding…">
                Sample Confluence
              </SubmitButton>
            </form>
            <form action={createAction}>
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="provider" value="sharepoint" />
              <input type="hidden" name="name" value="Sample SharePoint connector" />
              <input type="hidden" name="demo" value="true" />
              <SubmitButton variant="secondary" loadingText="Adding…">
                Sample SharePoint
              </SubmitButton>
            </form>
            <form action={createAction}>
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="provider" value="jira" />
              <input type="hidden" name="name" value="Sample Jira connector" />
              <input type="hidden" name="demo" value="true" />
              <SubmitButton variant="secondary" loadingText="Adding…">
                Sample Jira
              </SubmitButton>
            </form>
            <form action={createAction}>
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="provider" value="monday" />
              <input type="hidden" name="name" value="Sample Monday connector" />
              <input type="hidden" name="demo" value="true" />
              <SubmitButton variant="secondary" loadingText="Adding…">
                Sample Monday
              </SubmitButton>
            </form>
            <form action={createAction}>
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="provider" value="onedrive" />
              <input type="hidden" name="name" value="Sample OneDrive connector" />
              <input type="hidden" name="demo" value="true" />
              <SubmitButton variant="secondary" loadingText="Adding…">
                Sample OneDrive
              </SubmitButton>
            </form>
            <form action={createAction}>
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="provider" value="github" />
              <input type="hidden" name="name" value="Sample GitHub connector" />
              <input type="hidden" name="demo" value="true" />
              <SubmitButton variant="secondary" loadingText="Adding…">
                Sample GitHub
              </SubmitButton>
            </form>
          </div>
        </div>

        <form
          action={createAction}
          className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-4"
        >
          <input type="hidden" name="project_id" value={projectId} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Connector name</span>
              <input
                name="name"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                placeholder="HR Confluence"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Source type</span>
              <select
                name="provider"
                value={provider}
                onChange={(e) =>
                  setProvider(
                    e.target.value as
                      | 'confluence'
                      | 'sharepoint'
                      | 'jira'
                      | 'monday'
                      | 'onedrive'
                      | 'github',
                  )
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
              >
                <option value="confluence">Confluence</option>
                <option value="sharepoint">SharePoint</option>
                <option value="jira">Jira</option>
                <option value="monday">Monday.com</option>
                <option value="onedrive">OneDrive</option>
                <option value="github">GitHub</option>
              </select>
            </label>
          </div>

          {provider === 'confluence' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Confluence base URL</span>
                <input
                  name="confluence_base_url"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="https://company.atlassian.net/wiki"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Space key</span>
                <input
                  name="confluence_space_key"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="KT"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Auth email</span>
                <input
                  name="confluence_auth_email"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="name@company.com"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">API token</span>
                <input
                  name="confluence_access_token"
                  type="password"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="Confluence API token"
                />
              </label>
            </div>
          ) : provider === 'sharepoint' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">SharePoint site URL</span>
                <input
                  name="sharepoint_site_url"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="https://tenant.sharepoint.com/sites/Team"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Library path</span>
                <input
                  name="sharepoint_library_path"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="Shared Documents"
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-slate-600">Access token</span>
                <input
                  name="sharepoint_access_token"
                  type="password"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="Microsoft Graph / SharePoint bearer token"
                />
              </label>
            </div>
          ) : provider === 'jira' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Jira base URL</span>
                <input
                  name="jira_base_url"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="https://company.atlassian.net"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Project key</span>
                <input
                  name="jira_project_key"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="KT"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Auth email</span>
                <input
                  name="jira_auth_email"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="name@company.com"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">API token</span>
                <input
                  name="jira_access_token"
                  type="password"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="Atlassian API token"
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-slate-600">JQL (optional)</span>
                <input
                  name="jira_jql"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="project = KT ORDER BY updated DESC"
                />
              </label>
            </div>
          ) : provider === 'monday' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Monday API URL</span>
                <input
                  name="monday_api_url"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="https://api.monday.com/v2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Workspace URL (optional)</span>
                <input
                  name="monday_workspace_url"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="https://your-workspace.monday.com"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Board IDs</span>
                <input
                  name="monday_board_ids"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="123456789,987654321"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">API token</span>
                <input
                  name="monday_access_token"
                  type="password"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="Monday API token"
                />
              </label>
            </div>
          ) : provider === 'onedrive' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Drive ID</span>
                <input
                  name="onedrive_drive_id"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="b!xxxxxx"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Folder path (optional)</span>
                <input
                  name="onedrive_folder_path"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="KT/Runbooks"
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-slate-600">Access token</span>
                <input
                  name="onedrive_access_token"
                  type="password"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="Microsoft Graph bearer token"
                />
              </label>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Repository</span>
                <input
                  name="github_repository"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="owner/repo"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Branch (optional)</span>
                <input
                  name="github_branch"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="main"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Docs path (optional)</span>
                <input
                  name="github_docs_path"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="docs"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Personal access token (optional)</span>
                <input
                  name="github_access_token"
                  type="password"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  placeholder="GitHub token (for private repos)"
                />
              </label>
            </div>
          )}

          <p className="text-xs text-slate-500">
            Confluence/Jira use Atlassian API token auth. SharePoint and OneDrive use Microsoft
            Graph bearer tokens. Monday reads board items via GraphQL. GitHub sync reads repo
            documents from selected branch/path.
          </p>
          <div className="flex items-center gap-2">
            <SubmitButton loadingText="Saving…">Connect source</SubmitButton>
          </div>
        </form>

        <div className="space-y-3">
          {connectors.length ? (
            connectors.map((connector) => {
              const config = connector.config as Record<string, unknown>;
              const isConfluence = connector.provider === 'confluence';
              const isSharePoint = connector.provider === 'sharepoint';
              const isJira = connector.provider === 'jira';
              const isMonday = connector.provider === 'monday';
              const isOneDrive = connector.provider === 'onedrive';
              const sourceSummary = isConfluence
                ? `Space ${String(config.space_key ?? 'Space')} · ${String(config.base_url ?? '')}`
                : isSharePoint
                  ? `Library ${String(config.library_path ?? 'Library')} · ${String(config.site_url ?? '')}`
                  : isJira
                    ? `Project ${String(config.project_key ?? 'Key')} · ${String(config.base_url ?? '')}`
                    : isMonday
                      ? `Boards ${String(config.board_ids ?? 'N/A')} · ${String(config.workspace_url ?? config.api_url ?? '')}`
                      : isOneDrive
                        ? `Drive ${String(config.drive_id ?? 'N/A')} · Folder ${String(config.folder_path ?? '/')}`
                        : `Repo ${String(config.repository ?? 'owner/repo')} · Branch ${String(config.branch ?? 'main')}`;

              return (
                <div
                  key={connector.id}
                  className={cn(
                    'flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 lg:flex-row lg:items-center lg:justify-between',
                    connector.last_sync_status === 'failed' && 'border-rose-200 bg-rose-50/40',
                  )}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{connector.name}</p>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-slate-600 uppercase">
                        {connector.provider}
                      </span>
                      <span className="bg-brand-50 text-brand-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                        {connector.last_sync_status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{sourceSummary}</p>
                    {connector.last_sync_error && (
                      <p className="mt-1 text-sm text-rose-600">{connector.last_sync_error}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={syncAction}>
                      <input type="hidden" name="project_id" value={projectId} />
                      <input type="hidden" name="connector_id" value={connector.id} />
                      <SubmitButton variant="secondary" loadingText="Syncing…">
                        <span className="inline-flex items-center gap-1.5">
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Sync now
                        </span>
                      </SubmitButton>
                    </form>
                    <form action={deleteAction}>
                      <input type="hidden" name="project_id" value={projectId} />
                      <input type="hidden" name="connector_id" value={connector.id} />
                      <Button
                        type="submit"
                        variant="secondary"
                        className="text-rose-600 hover:text-rose-700"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </span>
                      </Button>
                    </form>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-sm text-slate-500">
              No external connectors yet. Add a Confluence space, SharePoint library, Jira project,
              Monday board, OneDrive drive, or GitHub repository to sync documents into this
              project.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
