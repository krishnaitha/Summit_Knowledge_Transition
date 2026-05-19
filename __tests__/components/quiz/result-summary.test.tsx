import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ResultSummary } from '@/components/quiz/result-summary';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('ResultSummary – disqualified', () => {
  it('renders the Disqualified heading', () => {
    render(
      <ResultSummary
        projectId="proj-1"
        score={0}
        totalMarks={10}
        percentage={0}
        disqualified
        disqualifyReason="Tab switching detected"
      />,
    );
    expect(screen.getByText(/disqualified/i)).toBeDefined();
  });

  it('renders the disqualify reason', () => {
    render(
      <ResultSummary
        projectId="proj-1"
        score={0}
        totalMarks={10}
        percentage={0}
        disqualified
        disqualifyReason="Tab switching detected"
      />,
    );
    expect(screen.getByText(/tab switching detected/i)).toBeDefined();
  });

  it('renders default disqualify reason when none is provided', () => {
    render(
      <ResultSummary projectId="proj-1" score={0} totalMarks={10} percentage={0} disqualified />,
    );
    expect(screen.getByText(/integrity violation/i)).toBeDefined();
  });

  it('does not show the score when disqualified', () => {
    render(
      <ResultSummary projectId="proj-1" score={8} totalMarks={10} percentage={80} disqualified />,
    );
    // Score and Quest submitted heading should NOT appear
    expect(screen.queryByText(/quest submitted/i)).toBeNull();
  });
});

describe('ResultSummary – normal result', () => {
  it('renders the "Quiz submitted" heading', () => {
    render(<ResultSummary projectId="proj-1" score={7} totalMarks={10} percentage={70} />);
    expect(screen.getByText(/quest submitted/i)).toBeDefined();
  });

  it('renders the score as numerator/denominator', () => {
    render(<ResultSummary projectId="proj-1" score={7} totalMarks={10} percentage={70} />);
    expect(screen.getByText('7')).toBeDefined();
    // Denominator rendered inside a span inside the score paragraph
    expect(screen.getByText('/10')).toBeDefined();
  });

  it('renders the percentage via formatPercent', () => {
    render(<ResultSummary projectId="proj-1" score={7} totalMarks={10} percentage={70} />);
    expect(screen.getByText('70%')).toBeDefined();
  });

  it('renders coaching plan recommendations when provided', () => {
    const coachingPlan = {
      weakSections: [{ section: 'React', score: 2, total: 5, percentage: 40 }],
      recommendations: [
        {
          section: 'react',
          focus: 'Focus on hooks and component lifecycle',
          documents: [{ id: 'doc1', name: 'React Basics.pdf' }],
        },
      ],
    };
    render(
      <ResultSummary
        projectId="proj-1"
        score={4}
        totalMarks={10}
        percentage={40}
        coachingPlan={coachingPlan}
      />,
    );
    expect(screen.getByText(/weak-area coaching plan/i)).toBeDefined();
    expect(screen.getByText(/focus on hooks and component lifecycle/i)).toBeDefined();
    expect(screen.getByText('React Basics.pdf')).toBeDefined();
  });

  it('does not render coaching section when no recommendations', () => {
    const coachingPlan = {
      weakSections: [],
      recommendations: [],
    };
    render(
      <ResultSummary
        projectId="proj-1"
        score={8}
        totalMarks={10}
        percentage={80}
        coachingPlan={coachingPlan}
      />,
    );
    expect(screen.queryByText(/weak-area coaching plan/i)).toBeNull();
  });

  it('does not render coaching section when coachingPlan is undefined', () => {
    render(<ResultSummary projectId="proj-1" score={8} totalMarks={10} percentage={80} />);
    expect(screen.queryByText(/weak-area coaching plan/i)).toBeNull();
  });
});
