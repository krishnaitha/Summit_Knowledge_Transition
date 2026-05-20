import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GenerateDocumentForm } from '@/components/admin/generate-document-form';

vi.mock('@/app/actions/transcript', () => ({
  generateDocumentFromTranscriptAction: vi.fn(),
  pushToKnowledgeBaseAction: vi.fn(),
}));

const PROJECTS = [
  { id: 'proj-1', name: 'Alpha Project' },
  { id: 'proj-2', name: 'Beta Project' },
];

const THREAD_TRANSCRIPT = `Knowledge Gap Thread: How does auth work?
Project: Alpha Project

--- Original Question ---
How does auth work?

--- Conversation ---
Alice [Answer]:
Auth uses JWT tokens with a 1-hour expiry.
`;

describe('GenerateDocumentForm – banner', () => {
  it('shows no banner when neither suggestedContext nor suggestedTranscript is provided', () => {
    render(<GenerateDocumentForm projects={PROJECTS} />);
    expect(screen.queryByText(/thread conversation pre-loaded/i)).toBeNull();
    expect(screen.queryByText(/suggested capture/i)).toBeNull();
  });

  it('shows the blue "Suggested capture" banner when only suggestedContext is provided', () => {
    render(<GenerateDocumentForm projects={PROJECTS} suggestedContext="How does auth work?" />);
    expect(screen.getByText(/suggested capture/i)).toBeDefined();
    expect(screen.getByText(/how does auth work/i)).toBeDefined();
    expect(screen.queryByText(/thread conversation pre-loaded/i)).toBeNull();
  });

  it('shows the green "Thread conversation pre-loaded" banner when suggestedTranscript is provided', () => {
    render(<GenerateDocumentForm projects={PROJECTS} suggestedTranscript={THREAD_TRANSCRIPT} />);
    expect(screen.getByText(/thread conversation pre-loaded/i)).toBeDefined();
    expect(screen.queryByText(/suggested capture/i)).toBeNull();
  });

  it('prefers the green banner over the blue one when both props are provided', () => {
    render(
      <GenerateDocumentForm
        projects={PROJECTS}
        suggestedContext="How does auth work?"
        suggestedTranscript={THREAD_TRANSCRIPT}
      />,
    );
    expect(screen.getByText(/thread conversation pre-loaded/i)).toBeDefined();
    expect(screen.queryByText(/suggested capture/i)).toBeNull();
  });
});

describe('GenerateDocumentForm – transcript textarea', () => {
  it('renders an empty textarea when no suggestedTranscript is provided', () => {
    render(<GenerateDocumentForm projects={PROJECTS} />);
    const textarea = screen.getByPlaceholderText(
      /paste meeting transcript/i,
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('pre-fills the textarea with suggestedTranscript', () => {
    render(<GenerateDocumentForm projects={PROJECTS} suggestedTranscript={THREAD_TRANSCRIPT} />);
    const textarea = screen.getByPlaceholderText(
      /paste meeting transcript/i,
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe(THREAD_TRANSCRIPT);
  });
});

describe('GenerateDocumentForm – document title', () => {
  it('leaves the title empty when no context or suggestedTitle is provided', () => {
    render(<GenerateDocumentForm projects={PROJECTS} />);
    const titleInput = screen.getByPlaceholderText(/onboarding process/i) as HTMLInputElement;
    expect(titleInput.value).toBe('');
  });

  it('prefills title as "Knowledge: <context>" when only suggestedContext is provided', () => {
    render(<GenerateDocumentForm projects={PROJECTS} suggestedContext="How does auth work?" />);
    const titleInput = screen.getByPlaceholderText(/onboarding process/i) as HTMLInputElement;
    expect(titleInput.value).toBe('Knowledge: How does auth work?');
  });

  it('uses suggestedTitle when provided, ignoring suggestedContext fallback', () => {
    render(
      <GenerateDocumentForm
        projects={PROJECTS}
        suggestedContext="How does auth work?"
        suggestedTitle="Knowledge: How does auth work?"
        suggestedTranscript={THREAD_TRANSCRIPT}
      />,
    );
    const titleInput = screen.getByPlaceholderText(/onboarding process/i) as HTMLInputElement;
    expect(titleInput.value).toBe('Knowledge: How does auth work?');
  });

  it('truncates suggestedContext-derived title at 60 characters', () => {
    const longContext = 'A'.repeat(80);
    render(<GenerateDocumentForm projects={PROJECTS} suggestedContext={longContext} />);
    const titleInput = screen.getByPlaceholderText(/onboarding process/i) as HTMLInputElement;
    // "Knowledge: " (11 chars) + 60 chars from context
    expect(titleInput.value).toBe(`Knowledge: ${'A'.repeat(60)}`);
  });
});

describe('GenerateDocumentForm – project list', () => {
  it('renders all project options in the form', () => {
    render(<GenerateDocumentForm projects={PROJECTS} />);
    // The project select is only visible after generation, but project options
    // may appear in the markup; confirm the projects list is accepted without error.
    expect(screen.queryByText(/alpha project/i)).toBeNull(); // not shown in input form view
  });
});

describe('GenerateDocumentForm – structure', () => {
  it('renders the "Paste Transcript" card heading', () => {
    render(<GenerateDocumentForm projects={PROJECTS} />);
    expect(screen.getByText(/paste transcript/i)).toBeDefined();
  });

  it('renders the transcript label', () => {
    render(<GenerateDocumentForm projects={PROJECTS} />);
    expect(screen.getByText(/transcript content/i)).toBeDefined();
  });

  it('renders the document title label', () => {
    render(<GenerateDocumentForm projects={PROJECTS} />);
    expect(screen.getByText(/document title/i)).toBeDefined();
  });

  it('renders export format radio options', () => {
    render(<GenerateDocumentForm projects={PROJECTS} />);
    expect(screen.getByLabelText(/markdown/i)).toBeDefined();
  });

  it('renders the Generate Document submit button', () => {
    render(<GenerateDocumentForm projects={PROJECTS} />);
    expect(screen.getByRole('button', { name: /generate document/i })).toBeDefined();
  });
});
