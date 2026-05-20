import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DocumentThreadsBoard } from '@/components/documents/document-threads-board';
import type { DocumentThreadCommentView, DocumentThreadView } from '@/lib/data';
import type { DocumentRecord } from '@/lib/types/database';

vi.mock('@/app/actions/document-threads', () => ({
  createDocumentThreadAction: vi.fn(),
  addDocumentThreadReplyAction: vi.fn(),
  updateDocumentThreadStatusAction: vi.fn(),
}));

vi.mock('@/components/documents/bot-reply-poller', () => ({
  BotReplyPoller: ({ threadId }: { threadId: string }) => (
    <div data-testid={`bot-poller-${threadId}`}>BotReplyPoller</div>
  ),
}));

vi.mock('@/components/ui/markdown-content', () => ({
  MarkdownContent: ({ content }: { content: string }) => <span>{content}</span>,
}));

vi.mock('@/lib/env', () => ({
  appEnv: { botName: 'Test Bot AI', appName: 'Test App', appUrl: 'http://localhost:3000' },
}));

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return { ...actual, formatDate: () => 'Jan 1, 2026' };
});

const document: DocumentRecord = {
  id: 'doc-1',
  project_id: 'proj-1',
  file_name: 'onboarding.pdf',
  file_url: '/files/onboarding.pdf',
  file_type: 'application/pdf',
  uploaded_by: 'user-1',
  uploaded_at: '2026-01-01T00:00:00Z',
  chunk_count: 10,
  pii_detections: 0,
  classification: 'internal',
  is_required: true,
  scan_flags: [],
};

const baseComment: DocumentThreadCommentView = {
  id: 'c1',
  thread_id: 't1',
  author_id: 'user-1',
  body: 'Can you clarify step 3?',
  is_answer: false,
  is_bot: false,
  sources: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  author_name: 'Alice Smith',
  author_email: 'alice@example.com',
  author_global_role: 'member',
  author_project_role: 'member',
};

const botComment: DocumentThreadCommentView = {
  id: 'c2',
  thread_id: 't1',
  author_id: null,
  body: 'Here is the answer to your question.',
  is_answer: false,
  is_bot: true,
  sources: [{ document_name: 'onboarding.pdf' }, { document_name: 'handbook.pdf' }],
  created_at: '2026-01-01T01:00:00Z',
  updated_at: '2026-01-01T01:00:00Z',
  author_name: null,
  author_email: null,
  author_global_role: null,
  author_project_role: null,
};

function makeThread(overrides: Partial<DocumentThreadView> = {}): DocumentThreadView {
  return {
    id: 't1',
    project_id: 'proj-1',
    document_id: 'doc-1',
    created_by: 'user-1',
    title: 'What does step 3 mean?',
    page_number: null,
    status: 'open',
    resolved_by: null,
    resolved_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    source: 'document',
    gap_query: null,
    creator_name: 'Alice Smith',
    creator_email: 'alice@example.com',
    comment_count: 1,
    comments: [baseComment],
    ...overrides,
  };
}

describe('DocumentThreadsBoard – empty state', () => {
  it('shows empty state message when there are no threads', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[]}
        canModerate={false}
      />,
    );
    expect(screen.getByText('No discussion threads yet for this document.')).toBeDefined();
  });

  it('renders the "Start a Discussion" form', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[]}
        canModerate={false}
      />,
    );
    expect(screen.getByText('Start a Discussion')).toBeDefined();
    expect(screen.getByPlaceholderText(/Question title/)).toBeDefined();
  });
});

describe('DocumentThreadsBoard – thread header', () => {
  it('renders the thread title', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread()]}
        canModerate={false}
      />,
    );
    expect(screen.getByText('What does step 3 mean?')).toBeDefined();
  });

  it('shows "Open" badge for open threads', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread({ status: 'open' })]}
        canModerate={false}
      />,
    );
    expect(screen.getByText('Open')).toBeDefined();
  });

  it('shows "Resolved" badge for resolved threads', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread({ status: 'resolved', comments: [baseComment, botComment] })]}
        canModerate={false}
      />,
    );
    expect(screen.getByText('Resolved')).toBeDefined();
  });

  it('shows page number badge when set', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread({ page_number: 5 })]}
        canModerate={false}
      />,
    );
    expect(screen.getByText('Page 5')).toBeDefined();
  });

  it('does not show page badge when page_number is null', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread({ page_number: null })]}
        canModerate={false}
      />,
    );
    expect(screen.queryByText(/^Page \d+$/)).toBeNull();
  });
});

describe('DocumentThreadsBoard – user comments', () => {
  it('renders the comment body', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread()]}
        canModerate={false}
      />,
    );
    expect(screen.getByText('Can you clarify step 3?')).toBeDefined();
  });

  it('renders the author display name', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread()]}
        canModerate={false}
      />,
    );
    expect(screen.getByText('Alice Smith')).toBeDefined();
  });
});

describe('DocumentThreadsBoard – bot comments', () => {
  it('renders the bot name from appEnv', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread({ comments: [botComment] })]}
        canModerate={false}
      />,
    );
    expect(screen.getByText('Test Bot AI')).toBeDefined();
  });

  it('renders the "Bot" badge', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread({ comments: [botComment] })]}
        canModerate={false}
      />,
    );
    expect(screen.getByText('Bot')).toBeDefined();
  });

  it('renders source document pills', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread({ comments: [botComment] })]}
        canModerate={false}
      />,
    );
    expect(screen.getByText('onboarding.pdf')).toBeDefined();
    expect(screen.getByText('handbook.pdf')).toBeDefined();
  });

  it('does not render sources section when sources is null', () => {
    const botNoSources = { ...botComment, sources: null };
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread({ comments: [botNoSources] })]}
        canModerate={false}
      />,
    );
    expect(screen.queryByText('Sources:')).toBeNull();
  });

  it('does not render sources section when sources is empty', () => {
    const botEmptySources = { ...botComment, sources: [] };
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread({ comments: [botEmptySources] })]}
        canModerate={false}
      />,
    );
    expect(screen.queryByText('Sources:')).toBeNull();
  });
});

describe('DocumentThreadsBoard – BotReplyPoller visibility', () => {
  it('shows BotReplyPoller for an open thread with no bot reply', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread({ status: 'open', comments: [baseComment] })]}
        canModerate={false}
      />,
    );
    expect(screen.getByTestId('bot-poller-t1')).toBeDefined();
  });

  it('does not show BotReplyPoller when a bot reply already exists', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread({ status: 'open', comments: [baseComment, botComment] })]}
        canModerate={false}
      />,
    );
    expect(screen.queryByTestId('bot-poller-t1')).toBeNull();
  });

  it('does not show BotReplyPoller for a resolved thread', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread({ status: 'resolved', comments: [baseComment] })]}
        canModerate={false}
      />,
    );
    expect(screen.queryByTestId('bot-poller-t1')).toBeNull();
  });
});

describe('DocumentThreadsBoard – moderation controls', () => {
  it('shows "Mark resolved" for moderator on an open thread', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread({ status: 'open' })]}
        canModerate={true}
      />,
    );
    expect(screen.getByText('Mark resolved')).toBeDefined();
  });

  it('shows "Reopen" for moderator on a resolved thread', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread({ status: 'resolved', comments: [baseComment, botComment] })]}
        canModerate={true}
      />,
    );
    expect(screen.getByText('Reopen')).toBeDefined();
  });

  it('does not show moderation buttons for non-moderators', () => {
    render(
      <DocumentThreadsBoard
        projectId="proj-1"
        document={document}
        threads={[makeThread({ status: 'open' })]}
        canModerate={false}
      />,
    );
    expect(screen.queryByText('Mark resolved')).toBeNull();
    expect(screen.queryByText('Reopen')).toBeNull();
  });
});
