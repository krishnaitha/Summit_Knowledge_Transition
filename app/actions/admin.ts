'use server';

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { parse } from 'csv-parse/sync';
import { revalidatePath, revalidateTag } from 'next/cache';

import { requireAdmin } from '@/lib/auth';
import sql from '@/lib/db';
import { isR2Configured } from '@/lib/env';
import { getLlmRuntimeConfig, getLlmRuntimeSecrets } from '@/lib/llm/runtime-config';
import { computeSectionScores } from '@/lib/quiz/scoring';
import { deleteFile } from '@/lib/storage/local';
import { deleteFromR2 } from '@/lib/storage/r2';
import type { AssignedQuestion, QuizOptionKey } from '@/lib/types/database';

export async function createProjectAction(formData: FormData) {
  const payload = {
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    created_by: String(formData.get('created_by') ?? ''),
    pass_threshold: Number(formData.get('pass_threshold') ?? 60),
  };

  await sql`
    INSERT INTO projects (name, description, created_by, pass_threshold, is_active)
    VALUES (${payload.name}, ${payload.description}, ${payload.created_by}, ${payload.pass_threshold}, true)
  `;
  revalidatePath('/admin/projects');
}

export async function updateProjectSettingsAction(formData: FormData) {
  await requireAdmin();

  const projectId = String(formData.get('project_id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const passThresholdRaw = Number(formData.get('pass_threshold') ?? 60);

  if (!projectId || !name) return;

  const passThreshold = Math.min(
    100,
    Math.max(0, Number.isFinite(passThresholdRaw) ? passThresholdRaw : 60),
  );

  await sql`
    UPDATE projects
    SET
      name = ${name.slice(0, 140)},
      description = ${description ? description.slice(0, 5000) : null},
      pass_threshold = ${passThreshold}
    WHERE id = ${projectId}
  `;

  revalidatePath('/admin/projects');
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/quiz`);
}

export async function toggleProjectStatusAction(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const nextState = String(formData.get('next_state') ?? 'true') === 'true';

  await sql`UPDATE projects SET is_active = ${nextState} WHERE id = ${projectId}`;
  revalidatePath('/admin/projects');
  revalidatePath(`/admin/projects/${projectId}`);
  revalidateTag(`project:${projectId}`, 'max');
}

async function ensureAppSettingsSchema() {
  await sql`
    create table if not exists app_settings (
      key text primary key,
      value jsonb not null,
      updated_by uuid references users(id) on delete set null,
      updated_at timestamptz not null default now()
    )
  `;
}

export async function updateLlmRuntimeConfigAction(formData: FormData) {
  const { profile } = await requireAdmin();

  const provider = String(formData.get('llm_provider') ?? 'groq').trim();
  const copilotModelInput = String(formData.get('copilot_model') ?? '').trim();
  const groqChatModelInput = String(formData.get('groq_chat_model') ?? '').trim();
  const groqQuizModelInput = String(formData.get('groq_quiz_model') ?? '').trim();
  const openAiModelInput = String(formData.get('openai_model') ?? '').trim();
  const azureOpenAiDeploymentInput = String(formData.get('azure_openai_deployment') ?? '').trim();
  const anthropicModelInput = String(formData.get('anthropic_model') ?? '').trim();
  const mistralModelInput = String(formData.get('mistral_model') ?? '').trim();
  const ollamaModelInput = String(formData.get('ollama_model') ?? '').trim();

  if (
    !['groq', 'copilot', 'openai', 'azure-openai', 'anthropic', 'mistral', 'ollama'].includes(
      provider,
    )
  ) {
    return;
  }

  await ensureAppSettingsSchema();

  const currentConfig = await getLlmRuntimeConfig();
  const currentSecrets = await getLlmRuntimeSecrets();
  const groqApiKeyInput = String(formData.get('groq_api_key') ?? '').trim();
  const groqQuizApiKeyInput = String(formData.get('groq_quiz_api_key') ?? '').trim();
  const copilotProxyTokenInput = String(formData.get('copilot_proxy_token') ?? '').trim();
  const copilotBaseUrlInput = String(formData.get('copilot_base_url') ?? '').trim();
  const openAiApiKeyInput = String(formData.get('openai_api_key') ?? '').trim();
  const openAiBaseUrlInput = String(formData.get('openai_base_url') ?? '').trim();
  const azureOpenAiApiKeyInput = String(formData.get('azure_openai_api_key') ?? '').trim();
  const azureOpenAiEndpointInput = String(formData.get('azure_openai_endpoint') ?? '').trim();
  const azureOpenAiApiVersionInput = String(formData.get('azure_openai_api_version') ?? '').trim();
  const anthropicApiKeyInput = String(formData.get('anthropic_api_key') ?? '').trim();
  const anthropicBaseUrlInput = String(formData.get('anthropic_base_url') ?? '').trim();
  const mistralApiKeyInput = String(formData.get('mistral_api_key') ?? '').trim();
  const mistralBaseUrlInput = String(formData.get('mistral_base_url') ?? '').trim();
  const ollamaBaseUrlInput = String(formData.get('ollama_base_url') ?? '').trim();

  const nextSecrets: Record<string, string> = {
    groqApiKey:
      String(formData.get('clear_groq_api_key') ?? '') === 'true'
        ? ''
        : groqApiKeyInput || currentSecrets.groqApiKey,
    groqQuizApiKey:
      String(formData.get('clear_groq_quiz_api_key') ?? '') === 'true'
        ? ''
        : groqQuizApiKeyInput || currentSecrets.groqQuizApiKey,
    copilotProxyToken:
      String(formData.get('clear_copilot_proxy_token') ?? '') === 'true'
        ? ''
        : copilotProxyTokenInput || currentSecrets.copilotProxyToken,
    copilotBaseUrl: copilotBaseUrlInput || currentSecrets.copilotBaseUrl,
    openAiApiKey:
      String(formData.get('clear_openai_api_key') ?? '') === 'true'
        ? ''
        : openAiApiKeyInput || currentSecrets.openAiApiKey,
    openAiBaseUrl: openAiBaseUrlInput || currentSecrets.openAiBaseUrl,
    azureOpenAiApiKey:
      String(formData.get('clear_azure_openai_api_key') ?? '') === 'true'
        ? ''
        : azureOpenAiApiKeyInput || currentSecrets.azureOpenAiApiKey,
    azureOpenAiEndpoint: azureOpenAiEndpointInput || currentSecrets.azureOpenAiEndpoint,
    azureOpenAiApiVersion: azureOpenAiApiVersionInput || currentSecrets.azureOpenAiApiVersion,
    anthropicApiKey:
      String(formData.get('clear_anthropic_api_key') ?? '') === 'true'
        ? ''
        : anthropicApiKeyInput || currentSecrets.anthropicApiKey,
    anthropicBaseUrl: anthropicBaseUrlInput || currentSecrets.anthropicBaseUrl,
    mistralApiKey:
      String(formData.get('clear_mistral_api_key') ?? '') === 'true'
        ? ''
        : mistralApiKeyInput || currentSecrets.mistralApiKey,
    mistralBaseUrl: mistralBaseUrlInput || currentSecrets.mistralBaseUrl,
    ollamaBaseUrl: ollamaBaseUrlInput || currentSecrets.ollamaBaseUrl,
  };

  const nextConfig = {
    provider,
    copilotModel: copilotModelInput || currentConfig.copilotModel,
    groqChatModel: groqChatModelInput || currentConfig.groqChatModel,
    groqQuizModel: groqQuizModelInput || currentConfig.groqQuizModel,
    openAiModel: openAiModelInput || currentConfig.openAiModel,
    azureOpenAiDeployment: azureOpenAiDeploymentInput || currentConfig.azureOpenAiDeployment,
    anthropicModel: anthropicModelInput || currentConfig.anthropicModel,
    mistralModel: mistralModelInput || currentConfig.mistralModel,
    ollamaModel: ollamaModelInput || currentConfig.ollamaModel,
  };

  await sql`
    insert into app_settings (key, value, updated_by, updated_at)
    values (
      'llm_config',
      ${sql.json(nextConfig)},
      ${profile?.id ?? null},
      now()
    )
    on conflict (key) do update
      set value = excluded.value,
          updated_by = excluded.updated_by,
          updated_at = now()
  `;

  await sql`
    insert into app_settings (key, value, updated_by, updated_at)
    values (
      'llm_secrets',
      ${sql.json(nextSecrets)},
      ${profile?.id ?? null},
      now()
    )
    on conflict (key) do update
      set value = excluded.value,
          updated_by = excluded.updated_by,
          updated_at = now()
  `;

  revalidatePath('/admin/model-switcher');
}

export async function deleteDocumentAction(formData: FormData) {
  const documentId = String(formData.get('document_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  const storagePath = String(formData.get('file_url') ?? '');

  if (storagePath) {
    try {
      if (isR2Configured()) {
        await deleteFromR2(storagePath);
      } else {
        await deleteFile(storagePath);
      }
    } catch {
      // Non-fatal if file already removed
    }
  }

  await sql`DELETE FROM documents WHERE id = ${documentId}`;
  await sql`DELETE FROM document_chunks WHERE document_id = ${documentId}`;

  revalidatePath(`/admin/projects/${projectId}/documents`);
  revalidateTag(`project-docs:${projectId}`, 'max');
}

function buildConnectorConfig(formData: FormData, provider: string) {
  const isDemo = String(formData.get('demo') ?? '') === 'true';

  if (isDemo && provider === 'confluence') {
    return {
      demo: true,
      base_url: 'https://demo.atlassian.net/wiki',
      space_key: 'KT',
      auth_email: 'demo@sample.local',
      access_token: 'demo-token',
    };
  }

  if (isDemo && provider === 'sharepoint') {
    return {
      demo: true,
      site_url: 'https://demo.sharepoint.com/sites/KT',
      library_path: 'Shared Documents',
      access_token: 'demo-token',
    };
  }

  if (isDemo && provider === 'jira') {
    return {
      demo: true,
      base_url: 'https://demo.atlassian.net',
      project_key: 'KT',
      auth_email: 'demo@sample.local',
      access_token: 'demo-token',
      jql: 'project = KT ORDER BY updated DESC',
    };
  }

  if (isDemo && provider === 'monday') {
    return {
      demo: true,
      api_url: 'https://api.monday.com/v2',
      workspace_url: 'https://demo.monday.com',
      board_ids: '123456789',
      access_token: 'demo-token',
    };
  }

  if (isDemo && provider === 'onedrive') {
    return {
      demo: true,
      drive_id: 'demo-drive-id',
      folder_path: 'KT Docs',
      access_token: 'demo-token',
    };
  }

  if (isDemo && provider === 'github') {
    return {
      demo: true,
      repository: 'octocat/Hello-World',
      branch: 'main',
      docs_path: 'docs',
      access_token: 'demo-token',
    };
  }

  if (provider === 'confluence') {
    return {
      base_url: String(formData.get('confluence_base_url') ?? '').trim(),
      space_key: String(formData.get('confluence_space_key') ?? '').trim(),
      auth_email: String(formData.get('confluence_auth_email') ?? '').trim(),
      access_token: String(formData.get('confluence_access_token') ?? '').trim(),
    };
  }

  if (provider === 'jira') {
    return {
      base_url: String(formData.get('jira_base_url') ?? '').trim(),
      project_key: String(formData.get('jira_project_key') ?? '').trim(),
      auth_email: String(formData.get('jira_auth_email') ?? '').trim(),
      access_token: String(formData.get('jira_access_token') ?? '').trim(),
      jql: String(formData.get('jira_jql') ?? '').trim(),
    };
  }

  if (provider === 'monday') {
    return {
      api_url: String(formData.get('monday_api_url') ?? '').trim(),
      workspace_url: String(formData.get('monday_workspace_url') ?? '').trim(),
      board_ids: String(formData.get('monday_board_ids') ?? '').trim(),
      access_token: String(formData.get('monday_access_token') ?? '').trim(),
    };
  }

  if (provider === 'onedrive') {
    return {
      drive_id: String(formData.get('onedrive_drive_id') ?? '').trim(),
      folder_path: String(formData.get('onedrive_folder_path') ?? '').trim(),
      access_token: String(formData.get('onedrive_access_token') ?? '').trim(),
    };
  }

  if (provider === 'github') {
    return {
      repository: String(formData.get('github_repository') ?? '').trim(),
      branch: String(formData.get('github_branch') ?? '').trim(),
      docs_path: String(formData.get('github_docs_path') ?? '').trim(),
      access_token: String(formData.get('github_access_token') ?? '').trim(),
    };
  }

  return {
    site_url: String(formData.get('sharepoint_site_url') ?? '').trim(),
    library_path: String(formData.get('sharepoint_library_path') ?? '').trim(),
    access_token: String(formData.get('sharepoint_access_token') ?? '').trim(),
  };
}

async function ensureConnectorSchema() {
  await sql`
    create table if not exists document_connectors (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null references projects(id) on delete cascade,
      provider text not null check (provider in ('confluence', 'sharepoint', 'jira', 'monday', 'onedrive', 'github')),
      name text not null,
      config jsonb not null default '{}'::jsonb,
      created_by uuid references users(id) on delete set null,
      is_active boolean not null default true,
      auto_sync_enabled boolean not null default true,
      last_synced_at timestamptz,
      last_sync_status text not null default 'idle' check (last_sync_status in ('idle', 'running', 'success', 'failed')),
      last_sync_error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists document_connectors_project_created_at on document_connectors (project_id, created_at desc)`;

  await sql`
    alter table document_connectors
      add column if not exists auto_sync_enabled boolean not null default true
  `;

  await sql`
    alter table document_connectors
      add column if not exists last_sync_summary jsonb
  `;

  await sql`
    alter table document_connectors
      drop constraint if exists document_connectors_provider_check
  `;

  await sql`
    alter table document_connectors
      add constraint document_connectors_provider_check
      check (provider in ('confluence', 'sharepoint', 'jira', 'monday', 'onedrive', 'github'))
  `;

  await sql`
    alter table documents
      add column if not exists source_connector_id uuid references document_connectors(id) on delete set null,
      add column if not exists source_provider text check (source_provider in ('confluence', 'sharepoint', 'jira', 'monday', 'onedrive', 'github')),
      add column if not exists source_item_id text,
      add column if not exists source_url text,
      add column if not exists source_synced_at timestamptz
  `;

  await sql`
    alter table documents
      drop constraint if exists documents_source_provider_check
  `;

  await sql`
    alter table documents
      add constraint documents_source_provider_check
      check (source_provider in ('confluence', 'sharepoint', 'jira', 'monday', 'onedrive', 'github'))
  `;

  await sql`
    create unique index if not exists documents_source_connector_item_unique
      on documents (source_connector_id, source_item_id)
      where source_connector_id is not null and source_item_id is not null
  `;
}

export async function createDocumentConnectorAction(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '').trim();
  const provider = String(formData.get('provider') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();

  if (
    !projectId ||
    !name ||
    !['confluence', 'sharepoint', 'jira', 'monday', 'onedrive', 'github'].includes(provider)
  )
    return;

  await ensureConnectorSchema();
  const config = buildConnectorConfig(formData, provider);
  const { profile } = await requireAdmin();

  const rows = await sql<{ id: string }[]>`
    INSERT INTO document_connectors (project_id, provider, name, config, created_by)
    VALUES (${projectId}, ${provider}, ${name.slice(0, 140)}, ${sql.json(config)}, ${profile?.id ?? null})
    RETURNING id
  `;

  const connectorId = rows[0]?.id;

  if (connectorId && String(formData.get('demo') ?? '') === 'true') {
    const { syncDocumentConnector } = await import('@/lib/documents/connectors');
    await syncDocumentConnector(connectorId);
  }

  revalidatePath(`/admin/projects/${projectId}/documents`);
}

export async function syncDocumentConnectorAction(formData: FormData) {
  const { requireAdmin } = await import('@/lib/auth');
  await requireAdmin();

  const projectId = String(formData.get('project_id') ?? '').trim();
  const connectorId = String(formData.get('connector_id') ?? '').trim();

  if (!projectId || !connectorId) return;

  try {
    await ensureConnectorSchema();
    const { syncDocumentConnector } = await import('@/lib/documents/connectors');
    await syncDocumentConnector(connectorId);
  } catch (error) {
    console.error('[Sync Connector Error]', error);
    throw error;
  }

  revalidatePath(`/admin/projects/${projectId}/documents`);
}

export async function testDocumentConnectorAction(formData: FormData) {
  const { requireAdmin } = await import('@/lib/auth');
  await requireAdmin();

  const projectId = String(formData.get('project_id') ?? '').trim();
  const connectorId = String(formData.get('connector_id') ?? '').trim();

  if (!projectId || !connectorId) return;

  try {
    await ensureConnectorSchema();
    const { syncDocumentConnector } = await import('@/lib/documents/connectors');
    await syncDocumentConnector(connectorId, { mode: 'test' });
  } catch (error) {
    console.error('[Test Connector Error]', error);
    throw error;
  }

  revalidatePath(`/admin/projects/${projectId}/documents`);
}

export async function dryRunDocumentConnectorAction(formData: FormData) {
  const { requireAdmin } = await import('@/lib/auth');
  await requireAdmin();

  const projectId = String(formData.get('project_id') ?? '').trim();
  const connectorId = String(formData.get('connector_id') ?? '').trim();

  if (!projectId || !connectorId) return;

  try {
    await ensureConnectorSchema();
    const { syncDocumentConnector } = await import('@/lib/documents/connectors');
    await syncDocumentConnector(connectorId, { mode: 'dry-run' });
  } catch (error) {
    console.error('[Dry Run Connector Error]', error);
    throw error;
  }

  revalidatePath(`/admin/projects/${projectId}/documents`);
}

export async function deleteDocumentConnectorAction(formData: FormData) {
  await requireAdmin();

  const projectId = String(formData.get('project_id') ?? '').trim();
  const connectorId = String(formData.get('connector_id') ?? '').trim();

  if (!projectId || !connectorId) return;

  await sql`DELETE FROM document_connectors WHERE id = ${connectorId} AND project_id = ${projectId}`;
  revalidatePath(`/admin/projects/${projectId}/documents`);
}

export async function toggleDocumentConnectorAutoSyncAction(formData: FormData) {
  await requireAdmin();

  const projectId = String(formData.get('project_id') ?? '').trim();
  const connectorId = String(formData.get('connector_id') ?? '').trim();
  const nextValue = String(formData.get('next_auto_sync_enabled') ?? '').trim();

  if (!projectId || !connectorId || !['true', 'false'].includes(nextValue)) return;

  await ensureConnectorSchema();

  await sql`
    UPDATE document_connectors
    SET auto_sync_enabled = ${nextValue === 'true'},
        updated_at = now()
    WHERE id = ${connectorId} AND project_id = ${projectId}
  `;

  revalidatePath(`/admin/projects/${projectId}/documents`);
}

export async function toggleDocumentRequiredAction(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const documentId = String(formData.get('document_id') ?? '');
  const nextState = String(formData.get('next_required') ?? 'false') === 'true';

  if (!projectId || !documentId) return;

  await sql`
    UPDATE documents
    SET is_required = ${nextState}
    WHERE id = ${documentId} AND project_id = ${projectId}
  `;

  revalidatePath(`/admin/projects/${projectId}/documents`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/quiz`);
}

export async function inviteProjectMemberAction(formData: FormData) {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const projectId = String(formData.get('project_id') ?? '');

  if (!email || !projectId) return;

  // Check if user already exists
  const existing =
    await sql`SELECT id FROM users WHERE email = ${email} AND auth_provider = 'credentials' LIMIT 1`;
  const userId = existing[0]?.id as string | undefined;

  if (!userId) {
    // Create invite token and send email
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    await sql`
      INSERT INTO invite_tokens (email, token, role, project_id, expires_at)
      VALUES (${email}, ${token}, 'member', ${projectId}, ${expiresAt})
      ON CONFLICT (token) DO NOTHING
    `;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const inviteLink = `${appUrl}/auth/accept-invite?token=${token}`;

    // Send invite email via Resend (fire-and-forget; if Resend not configured, skip)
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM_EMAIL ?? 'notifications@summit.app';
      try {
        await resend.emails.send({
          from,
          to: email,
          subject: 'You have been invited to NextElevate',
          html: `
            <p>Hi${fullName ? ` ${fullName}` : ''},</p>
            <p>You have been invited to join <strong>NextElevate</strong>.</p>
            <p>Click the link below to set your password and access your account:</p>
            <p><a href="${inviteLink}">${inviteLink}</a></p>
            <p>This link expires in 7 days.</p>
          `,
        });
      } catch {
        // Email failure is non-fatal
      }
    }

    revalidatePath(`/admin/projects/${projectId}/members`);
    revalidateTag(`project-members:${projectId}`, 'max');
    return;
  }

  // User exists — add to project directly
  await sql`
    INSERT INTO project_members (project_id, user_id)
    VALUES (${projectId}, ${userId})
    ON CONFLICT (project_id, user_id) DO NOTHING
  `;
  revalidatePath(`/admin/projects/${projectId}/members`);
  revalidateTag(`project-members:${projectId}`, 'max');
}

export async function sendProjectAnnouncementAction(formData: FormData) {
  const { profile } = await requireAdmin();

  const projectId = String(formData.get('project_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  const expiresAtInput = String(formData.get('expires_at') ?? '').trim();

  if (!projectId || !title || !message) return;

  await sql`
    ALTER TABLE project_announcements
      ADD COLUMN IF NOT EXISTS expires_at timestamptz
  `;

  await sql`
    UPDATE project_announcements
    SET expires_at = COALESCE(expires_at, created_at + INTERVAL '72 hours')
    WHERE expires_at IS NULL
  `;

  await sql`
    ALTER TABLE project_announcements
      ALTER COLUMN expires_at SET DEFAULT now() + INTERVAL '72 hours'
  `;

  const fallbackExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const parsedExpiresAt = expiresAtInput ? new Date(expiresAtInput) : fallbackExpiresAt;
  const expiresAt = Number.isNaN(parsedExpiresAt.getTime()) ? fallbackExpiresAt : parsedExpiresAt;

  await sql`
    INSERT INTO project_announcements (project_id, title, message, sent_by, expires_at)
    VALUES (
      ${projectId},
      ${title.slice(0, 140)},
      ${message.slice(0, 2000)},
      ${profile?.id ?? null},
      ${expiresAt.toISOString()}
    )
  `;

  await sql`
    INSERT INTO activity_log (user_id, project_id, action, metadata)
    VALUES (
      ${profile?.id ?? null},
      ${projectId},
      'admin_announcement_sent',
      ${sql.json({ title: title.slice(0, 140), expiresAt: expiresAt.toISOString() })}
    )
  `;

  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath('/dashboard');
}

export async function removeProjectMemberAction(formData: FormData) {
  const userId = String(formData.get('user_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');

  await sql`
    DELETE FROM project_members WHERE project_id = ${projectId} AND user_id = ${userId}
  `;
  revalidatePath(`/admin/projects/${projectId}/members`);
  revalidateTag(`project-members:${projectId}`, 'max');
}

export async function updateProjectMemberRoleAction(formData: FormData) {
  const userId = String(formData.get('user_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  const role = String(formData.get('role') ?? 'member');

  if (!userId || !projectId || !['admin', 'member'].includes(role)) return;

  await sql`
    UPDATE project_members SET role = ${role} WHERE project_id = ${projectId} AND user_id = ${userId}
  `;
  revalidatePath(`/admin/projects/${projectId}/members`);
  revalidateTag(`project-members:${projectId}`, 'max');
}

const MAX_QUIZ_RESETS = 5;

export async function resetQuizAttemptAction(formData: FormData) {
  const attemptId = String(formData.get('attempt_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  const userId = String(formData.get('user_id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim() || 'Reset by admin';
  const resetBy = String(formData.get('reset_by') ?? '') || null;
  const sectionsJson = String(formData.get('sections_to_reset') ?? '');

  const resetCountRows = await sql`
    SELECT COUNT(*) as c FROM quiz_resets WHERE user_id = ${userId} AND project_id = ${projectId}
  `;
  if (Number(resetCountRows[0]?.c ?? 0) >= MAX_QUIZ_RESETS) return;

  const sectionsToReset: string[] | null = sectionsJson
    ? (JSON.parse(sectionsJson) as string[])
    : null;

  const attemptRows = await sql<
    {
      id: string;
      user_id: string;
      project_id: string;
      quiz_set_id: string;
      assigned_questions: AssignedQuestion[];
      answers_given: Record<string, QuizOptionKey> | null;
      score: number | null;
      total_marks: number | null;
      percentage: number | null;
      passed: boolean | null;
      submitted_at: string | null;
      status: 'in_progress' | 'submitted';
    }[]
  >`
    SELECT id, user_id, project_id, quiz_set_id, assigned_questions, answers_given,
           score, total_marks, percentage, passed, submitted_at, status
    FROM quiz_attempts
    WHERE id = ${attemptId}
    LIMIT 1
  `;
  const attempt = attemptRows[0];

  if (attempt && attempt.status === 'submitted') {
    await sql`
      INSERT INTO quiz_attempt_history (
        original_attempt_id,
        user_id,
        project_id,
        quiz_set_id,
        score,
        total_marks,
        percentage,
        passed,
        submitted_at,
        reset_by,
        reset_reason
      )
      VALUES (
        ${attempt.id},
        ${attempt.user_id},
        ${attempt.project_id},
        ${attempt.quiz_set_id},
        ${attempt.score},
        ${attempt.total_marks},
        ${attempt.percentage},
        ${attempt.passed},
        ${attempt.submitted_at},
        ${resetBy},
        ${reason}
      )
    `;
  }

  if (sectionsToReset && sectionsToReset.length > 0) {
    if (attempt) {
      const assignedQs = (attempt.assigned_questions ?? []) as AssignedQuestion[];
      const answersGiven = (attempt.answers_given ?? {}) as Record<string, QuizOptionKey>;
      const allSectionScores = computeSectionScores(assignedQs, answersGiven);

      const carriedSections: Record<string, { score: number; total: number }> = {};
      for (const [sec, scores] of Object.entries(allSectionScores)) {
        if (!sectionsToReset.includes(sec)) {
          carriedSections[sec] = scores;
        }
      }

      await sql`DELETE FROM quiz_attempts WHERE id = ${attemptId}`;
      await sql`
        INSERT INTO quiz_attempts (user_id, project_id, quiz_set_id, assigned_questions, answers_given, status, carried_sections)
        VALUES (${userId}, ${projectId}, ${attempt.quiz_set_id}, ${sql.json([])}, ${sql.json({})}, 'in_progress', ${Object.keys(carriedSections).length > 0 ? sql.json(carriedSections) : null})
      `;
    } else {
      await sql`DELETE FROM quiz_attempts WHERE id = ${attemptId}`;
    }
  } else {
    await sql`DELETE FROM quiz_attempts WHERE id = ${attemptId}`;
  }

  await sql`
    INSERT INTO quiz_resets (user_id, project_id, reset_by, reason)
    VALUES (${userId}, ${projectId}, ${resetBy}, ${reason})
  `;

  revalidatePath(`/admin/projects/${projectId}/analytics`);
}

export async function setQuizWindowAction(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const openAtRaw = (formData.get('quiz_open_at') as string | null) || '';
  const closeAtRaw = (formData.get('quiz_close_at') as string | null) || '';

  await sql`
    UPDATE projects SET
      quiz_open_at = ${openAtRaw ? new Date(openAtRaw).toISOString() : null},
      quiz_close_at = ${closeAtRaw ? new Date(closeAtRaw).toISOString() : null}
    WHERE id = ${projectId}
  `;

  revalidatePath(`/admin/projects/${projectId}/analytics`);
  revalidatePath(`/projects/${projectId}/quiz`);
  revalidateTag(`project:${projectId}`, 'max');
}

export async function deleteQuizSetAction(formData: FormData) {
  const setId = String(formData.get('set_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');

  await sql`DELETE FROM quiz_questions WHERE quiz_set_id = ${setId}`;
  await sql`DELETE FROM quiz_sets WHERE id = ${setId}`;
  revalidatePath(`/admin/projects/${projectId}/quiz`);
  revalidateTag(`project-quiz:${projectId}`, 'max');
}

export async function deleteQuizQuestionAction(formData: FormData) {
  const questionId = String(formData.get('question_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');

  await sql`DELETE FROM quiz_questions WHERE id = ${questionId}`;
  revalidatePath(`/admin/projects/${projectId}/quiz`);
  revalidateTag(`project-quiz:${projectId}`, 'max');
}

export async function createQuizSetAction(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const setName = String(formData.get('set_name') ?? '');
  const setNumber = Number(formData.get('set_number') ?? 1);
  const category =
    String(formData.get('category') ?? 'general')
      .trim()
      .toLowerCase() || 'general';

  await sql`
    INSERT INTO quiz_sets (project_id, set_name, set_number, category, is_active)
    VALUES (${projectId}, ${setName}, ${setNumber}, ${category}, true)
  `;
  revalidatePath(`/admin/projects/${projectId}/quiz`);
  revalidateTag(`project-quiz:${projectId}`, 'max');
}

export async function createQuizQuestionAction(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const quizSetId = String(formData.get('quiz_set_id') ?? '');
  const questionType = String(formData.get('question_type') ?? 'mcq');
  const isTrueFalse = questionType === 'true_false';

  await sql`
    INSERT INTO quiz_questions
      (quiz_set_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, question_type)
    VALUES (
      ${quizSetId},
      ${String(formData.get('question_text') ?? '')},
      ${String(formData.get('option_a') ?? '')},
      ${String(formData.get('option_b') ?? '')},
      ${isTrueFalse ? '' : String(formData.get('option_c') ?? '')},
      ${isTrueFalse ? '' : String(formData.get('option_d') ?? '')},
      ${String(formData.get('correct_option') ?? 'A')},
      ${String(formData.get('explanation') ?? '')},
      ${Number(formData.get('marks') ?? 1)},
      ${questionType}
    )
  `;
  revalidatePath(`/admin/projects/${projectId}/quiz`);
  revalidateTag(`project-quiz:${projectId}`, 'max');
}

export async function updateQuizQuestionAction(formData: FormData) {
  const questionId = String(formData.get('question_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  const questionType = String(formData.get('question_type') ?? 'mcq');
  const isTrueFalse = questionType === 'true_false';

  await sql`
    UPDATE quiz_questions SET
      question_text  = ${String(formData.get('question_text') ?? '')},
      option_a       = ${String(formData.get('option_a') ?? '')},
      option_b       = ${String(formData.get('option_b') ?? '')},
      option_c       = ${isTrueFalse ? '' : String(formData.get('option_c') ?? '')},
      option_d       = ${isTrueFalse ? '' : String(formData.get('option_d') ?? '')},
      correct_option = ${String(formData.get('correct_option') ?? 'A')},
      explanation    = ${String(formData.get('explanation') ?? '')},
      marks          = ${Number(formData.get('marks') ?? 1)},
      question_type  = ${questionType}
    WHERE id = ${questionId}
  `;
  revalidatePath(`/admin/projects/${projectId}/quiz`);
  revalidateTag(`project-quiz:${projectId}`, 'max');
}

export async function toggleQuizSetActiveAction(formData: FormData) {
  const setId = String(formData.get('set_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  const nextActive = formData.get('next_active') === 'true';

  await sql`UPDATE quiz_sets SET is_active = ${nextActive} WHERE id = ${setId}`;
  revalidatePath(`/admin/projects/${projectId}/quiz`);
  revalidateTag(`project-quiz:${projectId}`, 'max');
}

export async function importQuizCsvAction(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const quizSetId = String(formData.get('quiz_set_id') ?? '');
  const csvText = String(formData.get('csv_text') ?? '');

  if (!csvText.trim()) return;

  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;
  if (!rows.length) return;

  for (const row of rows) {
    await sql`
      INSERT INTO quiz_questions
        (quiz_set_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks)
      VALUES (
        ${quizSetId}, ${row.question_text}, ${row.option_a}, ${row.option_b},
        ${row.option_c}, ${row.option_d}, ${row.correct_option}, ${row.explanation}, ${Number(row.marks ?? 1)}
      )
    `;
  }

  revalidatePath(`/admin/projects/${projectId}/quiz`);
  revalidateTag(`project-quiz:${projectId}`, 'max');
}

export async function createDemoUserAction(formData: FormData) {
  await requireAdmin();

  const projectId = String(formData.get('project_id') ?? '').trim();

  const DEMO_EMAIL = 'demo@summit.app';
  const DEMO_PASSWORD = 'Demo@Summit1';
  const DEMO_NAME = 'Demo Member';

  const existing =
    await sql`SELECT id FROM users WHERE email = ${DEMO_EMAIL} AND auth_provider = 'credentials' LIMIT 1`;
  let userId = existing[0]?.id as string | undefined;

  if (!userId) {
    const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const newUser = await sql`
      INSERT INTO users (email, full_name, role, password_hash, is_active)
      VALUES (${DEMO_EMAIL}, ${DEMO_NAME}, 'member', ${hash}, true)
      RETURNING id
    `;
    userId = newUser[0]?.id as string;
  }

  if (projectId && userId) {
    await sql`
      INSERT INTO project_members (project_id, user_id)
      VALUES (${projectId}, ${userId})
      ON CONFLICT (project_id, user_id) DO NOTHING
    `;
  }

  revalidatePath('/admin/users');
}

export async function updateUserRoleAction(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? 'member');

  await sql`UPDATE users SET role = ${role} WHERE id = ${userId}`;
  revalidatePath('/admin/users');
}

export async function toggleUserActiveAction(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get('user_id') ?? '');
  const nextState = String(formData.get('next_state') ?? 'true') === 'true';

  await sql`UPDATE users SET is_active = ${nextState} WHERE id = ${userId}`;
  revalidatePath('/admin/users');
}

export async function bulkToggleUserActiveAction(formData: FormData) {
  await requireAdmin();

  const userIds = String(formData.get('user_ids') ?? '')
    .split(',')
    .filter(Boolean);
  const nextState = String(formData.get('next_state') ?? 'true') === 'true';

  if (userIds.length === 0) return;

  for (const userId of userIds) {
    await sql`UPDATE users SET is_active = ${nextState} WHERE id = ${userId}`;
  }
  revalidatePath('/admin/users');
}

export async function bulkUpdateUserRoleAction(formData: FormData) {
  await requireAdmin();

  const userIds = String(formData.get('user_ids') ?? '')
    .split(',')
    .filter(Boolean);
  const role = String(formData.get('role') ?? 'member');

  if (userIds.length === 0) return;

  for (const userId of userIds) {
    await sql`UPDATE users SET role = ${role} WHERE id = ${userId}`;
  }
  revalidatePath('/admin/users');
}

export async function bulkAssignToProjectAction(formData: FormData) {
  await requireAdmin();

  const userIds = String(formData.get('user_ids') ?? '')
    .split(',')
    .filter(Boolean);
  const projectId = String(formData.get('project_id') ?? '');

  if (userIds.length === 0 || !projectId) return;

  // Insert project members, ignoring conflicts
  for (const userId of userIds) {
    await sql`
      INSERT INTO project_members (project_id, user_id)
      VALUES (${projectId}, ${userId})
      ON CONFLICT (project_id, user_id) DO NOTHING
    `;
  }

  revalidatePath('/admin/users');
  revalidatePath(`/admin/projects/${projectId}/members`);
}

export async function approveRetakeRequestAction(formData: FormData) {
  await requireAdmin();

  const requestId = String(formData.get('request_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  const memberId = String(formData.get('member_id') ?? '');
  const adminId = String(formData.get('admin_id') ?? '') || null;

  // Delete the existing quiz attempt so the member can retake
  await sql`DELETE FROM quiz_attempts WHERE user_id = ${memberId} AND project_id = ${projectId}`;

  // Mark request as approved
  await sql`
    UPDATE quiz_retake_requests
    SET status = 'approved', resolved_at = NOW(), resolved_by = ${adminId}
    WHERE id = ${requestId}
  `;

  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}/analytics`);
}

export async function rejectRetakeRequestAction(formData: FormData) {
  await requireAdmin();

  const requestId = String(formData.get('request_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  const adminId = String(formData.get('admin_id') ?? '') || null;

  await sql`
    UPDATE quiz_retake_requests
    SET status = 'rejected', resolved_at = NOW(), resolved_by = ${adminId}
    WHERE id = ${requestId}
  `;

  revalidatePath(`/admin/projects/${projectId}`);
}

