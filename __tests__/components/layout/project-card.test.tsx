import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProjectCard } from '@/components/layout/project-card';
import type { ProjectDashboardCard } from '@/lib/types/database';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const baseProject: ProjectDashboardCard = {
  id: 'proj-1',
  name: 'Onboarding KT',
  description: 'Knowledge transfer for new team members',
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  is_active: true,
  documentCount: 10,
  docsViewedCount: 4,
  isNewDocs: false,
  quizStatus: 'Not Started',
  quizScoreLabel: null,
  quizPercentage: null,
  quizPassed: null,
  quizCloseAt: null,
};

describe('ProjectCard', () => {
  it('renders the project name', () => {
    render(<ProjectCard project={baseProject} />);
    expect(screen.getByText('Onboarding KT')).toBeDefined();
  });

  it('renders the project description', () => {
    render(<ProjectCard project={baseProject} />);
    expect(screen.getByText('Knowledge transfer for new team members')).toBeDefined();
  });

  it('renders the quiz status badge', () => {
    render(<ProjectCard project={baseProject} />);
    expect(screen.getByText('Not Started')).toBeDefined();
  });

  it('renders "In Progress" quiz status with warning variant', () => {
    render(<ProjectCard project={{ ...baseProject, quizStatus: 'In Progress' }} />);
    const badge = screen.getByText('In Progress');
    expect(badge.className).toContain('text-amber-700');
  });

  it('renders "Completed" quiz status with success variant', () => {
    render(<ProjectCard project={{ ...baseProject, quizStatus: 'Completed' }} />);
    const badge = screen.getByText('Completed');
    expect(badge.className).toContain('text-emerald-700');
  });

  it('renders docs reviewed count', () => {
    render(<ProjectCard project={baseProject} />);
    expect(screen.getByText('4/10')).toBeDefined();
  });

  it('links to the chat page', () => {
    render(<ProjectCard project={baseProject} />);
    const chatLink = screen.getByRole('link', { name: /elevate ai/i }) as HTMLAnchorElement;
    expect(chatLink.href).toContain('/projects/proj-1/chat');
  });

  it('links to the quiz page', () => {
    render(<ProjectCard project={baseProject} />);
    const quizLink = screen.getByRole('link', { name: /take quiz/i }) as HTMLAnchorElement;
    expect(quizLink.href).toContain('/projects/proj-1/quiz');
  });

  it('shows "Resume Quiz" button label when quiz is In Progress', () => {
    render(<ProjectCard project={{ ...baseProject, quizStatus: 'In Progress' }} />);
    expect(screen.getByRole('link', { name: /resume quiz/i })).toBeDefined();
  });

  it('links to the documents section', () => {
    render(<ProjectCard project={baseProject} />);
    const docsLink = screen.getByRole('link', { name: /documents/i }) as HTMLAnchorElement;
    expect(docsLink.href).toContain('/projects/proj-1#documents');
  });

  it('shows the "New docs" badge when isNewDocs is true', () => {
    render(<ProjectCard project={{ ...baseProject, isNewDocs: true }} />);
    expect(screen.getByText(/new docs/i)).toBeDefined();
  });

  it('does not show "New docs" badge when isNewDocs is false', () => {
    render(<ProjectCard project={baseProject} />);
    expect(screen.queryByText(/new docs/i)).toBeNull();
  });

  it('renders quiz percentage and pass/fail when score is available', () => {
    render(
      <ProjectCard
        project={{
          ...baseProject,
          quizStatus: 'Completed',
          quizPercentage: 85,
          quizPassed: true,
        }}
      />,
    );
    expect(screen.getByText(/85%.*passed/i)).toBeDefined();
  });

  it('shows overdue badge when quiz close date is in the past', () => {
    render(
      <ProjectCard
        project={{
          ...baseProject,
          quizStatus: 'Not Started',
          quizCloseAt: '2020-01-01T00:00:00Z', // well in the past
        }}
      />,
    );
    expect(screen.getByText(/overdue/i)).toBeDefined();
  });

  it('shows "Due today" badge when quiz closes today', () => {
    // Use current time: the component renders after this line, so
    // Date.now() inside daysUntil will be >= closeAt, making diff ≤ 0.
    // Math.ceil(−fraction) = 0 → "Due today" label.
    const now = new Date();
    render(
      <ProjectCard
        project={{
          ...baseProject,
          quizStatus: 'Not Started',
          quizCloseAt: now.toISOString(),
        }}
      />,
    );
    expect(screen.getByText(/due today/i)).toBeDefined();
  });

  it('does not show deadline badge when quiz is completed', () => {
    render(
      <ProjectCard
        project={{
          ...baseProject,
          quizStatus: 'Completed',
          quizCloseAt: '2020-01-01T00:00:00Z',
        }}
      />,
    );
    expect(screen.queryByText(/overdue/i)).toBeNull();
  });
});
