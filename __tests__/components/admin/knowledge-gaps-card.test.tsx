import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeGapsCard } from '@/components/admin/knowledge-gaps-card';
import type { KnowledgeGap } from '@/lib/data';

vi.mock('@/components/admin/knowledge-gap-thread-button', () => ({
  KnowledgeGapThreadButton: ({ query }: { query: string }) => (
    <button type="button">Thread: {query}</button>
  ),
}));

const openGap: KnowledgeGap = {
  query: 'How does authentication work?',
  occurrences: 2,
  lastAskedAt: '2 days ago',
  projects: ['Alpha Project'],
  projectIds: ['proj-1'],
};

const openGapHighFreq: KnowledgeGap = {
  query: 'How does the billing system work?',
  occurrences: 7,
  lastAskedAt: '1 day ago',
  projects: ['Beta Project'],
  projectIds: ['proj-2'],
};

const openGapMidFreq: KnowledgeGap = {
  query: 'What is the SLA for incidents?',
  occurrences: 3,
  lastAskedAt: '3 days ago',
  projects: ['Beta Project'],
  projectIds: ['proj-2'],
};

const resolvedGap: KnowledgeGap = {
  query: 'What is the deployment process?',
  occurrences: 4,
  lastAskedAt: '5 days ago',
  projects: ['Beta Project'],
  projectIds: ['proj-2'],
  resolvedThreadId: 'thread-abc-123',
};

describe('KnowledgeGapsCard – empty state', () => {
  it('shows the empty-state message when gaps is empty', () => {
    render(<KnowledgeGapsCard gaps={[]} />);
    expect(screen.getByText(/no unanswered questions/i)).toBeDefined();
  });

  it('does not render a toggle or any gap row when empty', () => {
    render(<KnowledgeGapsCard gaps={[]} />);
    expect(screen.queryByText(/open/i)).toBeNull();
    expect(screen.queryByText(/resolved/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /show/i })).toBeNull();
  });
});

describe('KnowledgeGapsCard – header badges', () => {
  it('shows "N open" amber badge when there are only open gaps', () => {
    render(<KnowledgeGapsCard gaps={[openGap, openGapHighFreq]} />);
    expect(screen.getByText('2 open')).toBeDefined();
    expect(screen.queryByText(/resolved/)).toBeNull();
  });

  it('shows "M resolved" green badge when there are only resolved gaps', () => {
    render(<KnowledgeGapsCard gaps={[resolvedGap]} />);
    expect(screen.getByText('1 resolved')).toBeDefined();
    expect(screen.queryByText(/open/)).toBeNull();
  });

  it('shows both badges when there is a mix of open and resolved gaps', () => {
    render(<KnowledgeGapsCard gaps={[openGap, resolvedGap]} />);
    expect(screen.getByText('1 open')).toBeDefined();
    expect(screen.getByText('1 resolved')).toBeDefined();
  });
});

describe('KnowledgeGapsCard – open gap rows', () => {
  it('renders the query text for each open gap', () => {
    render(<KnowledgeGapsCard gaps={[openGap, openGapHighFreq]} />);
    expect(screen.getByText(openGap.query)).toBeDefined();
    expect(screen.getByText(openGapHighFreq.query)).toBeDefined();
  });

  it('renders a "Capture" link pointing to generate-document with context', () => {
    render(<KnowledgeGapsCard gaps={[openGap]} />);
    const captureLink = screen.getByRole('link', { name: /capture/i });
    expect(captureLink.getAttribute('href')).toContain('/admin/generate-document');
    expect(captureLink.getAttribute('href')).toContain(encodeURIComponent(openGap.query));
  });

  it('renders the Thread button for open gaps with projectIds', () => {
    render(<KnowledgeGapsCard gaps={[openGap]} />);
    expect(screen.getByRole('button', { name: /thread/i })).toBeDefined();
  });

  it('does not render a Thread button when projectIds is empty', () => {
    const noProject: KnowledgeGap = { ...openGap, projectIds: [] };
    render(<KnowledgeGapsCard gaps={[noProject]} />);
    expect(screen.queryByRole('button', { name: /thread/i })).toBeNull();
  });

  it('renders project name tag for each open gap', () => {
    render(<KnowledgeGapsCard gaps={[openGap]} />);
    expect(screen.getByText('Alpha Project')).toBeDefined();
  });
});

describe('KnowledgeGapsCard – occurrence badge colours', () => {
  it('applies red styling for occurrences >= 5', () => {
    const { container } = render(<KnowledgeGapsCard gaps={[openGapHighFreq]} />);
    const badge = container.querySelector('.bg-red-100');
    expect(badge).not.toBeNull();
  });

  it('applies amber styling for occurrences >= 3 and < 5', () => {
    const { container } = render(<KnowledgeGapsCard gaps={[openGapMidFreq]} />);
    const badge = container.querySelector('.bg-amber-100.text-amber-700');
    expect(badge).not.toBeNull();
  });

  it('applies slate styling for occurrences < 3', () => {
    const { container } = render(<KnowledgeGapsCard gaps={[openGap]} />);
    const badge = container.querySelector('.bg-slate-100');
    expect(badge).not.toBeNull();
  });
});

describe('KnowledgeGapsCard – resolved toggle', () => {
  it('does not show a toggle button when there are no resolved gaps', () => {
    render(<KnowledgeGapsCard gaps={[openGap]} />);
    expect(screen.queryByText(/show.*resolved/i)).toBeNull();
  });

  it('shows the toggle button when resolved gaps exist', () => {
    render(<KnowledgeGapsCard gaps={[resolvedGap]} />);
    expect(screen.getByText(/show 1 resolved/i)).toBeDefined();
  });

  it('hides resolved rows before the toggle is clicked', () => {
    render(<KnowledgeGapsCard gaps={[openGap, resolvedGap]} />);
    expect(screen.queryByText(resolvedGap.query)).toBeNull();
  });

  it('shows resolved rows after clicking the toggle', () => {
    render(<KnowledgeGapsCard gaps={[openGap, resolvedGap]} />);
    fireEvent.click(screen.getByText(/show 1 resolved/i));
    expect(screen.getByText(resolvedGap.query)).toBeDefined();
  });

  it('changes toggle label to "Hide resolved" after expanding', () => {
    render(<KnowledgeGapsCard gaps={[resolvedGap]} />);
    fireEvent.click(screen.getByText(/show 1 resolved/i));
    expect(screen.getByText(/hide resolved/i)).toBeDefined();
  });

  it('hides resolved rows again after toggling twice', () => {
    render(<KnowledgeGapsCard gaps={[openGap, resolvedGap]} />);
    const toggle = screen.getByText(/show 1 resolved/i);
    fireEvent.click(toggle);
    fireEvent.click(screen.getByText(/hide resolved/i));
    expect(screen.queryByText(resolvedGap.query)).toBeNull();
  });
});

describe('KnowledgeGapsCard – resolved gap rows', () => {
  function renderExpanded(gaps: KnowledgeGap[]) {
    render(<KnowledgeGapsCard gaps={gaps} />);
    fireEvent.click(screen.getByText(/show.*resolved/i));
  }

  it('renders the query text for resolved gap', () => {
    renderExpanded([resolvedGap]);
    expect(screen.getByText(resolvedGap.query)).toBeDefined();
  });

  it('renders "View thread" link pointing to the thread page', () => {
    renderExpanded([resolvedGap]);
    const link = screen.getByRole('link', { name: /view thread/i });
    expect(link.getAttribute('href')).toBe(
      `/admin/knowledge-gap-threads/${resolvedGap.resolvedThreadId}`,
    );
  });

  it('does not render a Capture link in resolved rows', () => {
    renderExpanded([resolvedGap]);
    expect(screen.queryByRole('link', { name: /capture/i })).toBeNull();
  });

  it('does not render a Thread button in resolved rows', () => {
    renderExpanded([resolvedGap]);
    expect(screen.queryByRole('button', { name: /thread/i })).toBeNull();
  });

  it('renders project name tag for resolved gaps', () => {
    renderExpanded([resolvedGap]);
    expect(screen.getByText('Beta Project')).toBeDefined();
  });
});

describe('KnowledgeGapsCard – open gaps remain visible regardless of toggle', () => {
  it('open gap rows are visible before toggle is clicked', () => {
    render(<KnowledgeGapsCard gaps={[openGap, resolvedGap]} />);
    expect(screen.getByText(openGap.query)).toBeDefined();
  });

  it('open gap rows remain visible after toggle is clicked', () => {
    render(<KnowledgeGapsCard gaps={[openGap, resolvedGap]} />);
    fireEvent.click(screen.getByText(/show.*resolved/i));
    expect(screen.getByText(openGap.query)).toBeDefined();
  });
});
