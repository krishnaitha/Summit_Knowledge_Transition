import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { QuizQuestionViewModel } from '@/components/quiz/question-view';
import { QuestionView } from '@/components/quiz/question-view';

const mockQuestion: QuizQuestionViewModel = {
  questionId: 'q1',
  questionText: 'What is the capital of France?',
  options: [
    { key: 'A', text: 'Berlin' },
    { key: 'B', text: 'Paris' },
    { key: 'C', text: 'Madrid' },
    { key: 'D', text: 'Rome' },
  ],
};

describe('QuestionView', () => {
  it('renders the question text', () => {
    render(<QuestionView question={mockQuestion} currentIndex={0} total={5} onSelect={vi.fn()} />);
    expect(screen.getByText('What is the capital of France?')).toBeDefined();
  });

  it('renders all four option buttons', () => {
    render(<QuestionView question={mockQuestion} currentIndex={0} total={5} onSelect={vi.fn()} />);
    expect(screen.getByText('Berlin')).toBeDefined();
    expect(screen.getByText('Paris')).toBeDefined();
    expect(screen.getByText('Madrid')).toBeDefined();
    expect(screen.getByText('Rome')).toBeDefined();
  });

  it('shows correct question progress label (1 of 5)', () => {
    render(<QuestionView question={mockQuestion} currentIndex={0} total={5} onSelect={vi.fn()} />);
    expect(screen.getByText('Question 1 of 5')).toBeDefined();
  });

  it('shows correct percentage for progress', () => {
    // index 2, total 5 → Math.round((3/5)*100) = 60%
    render(<QuestionView question={mockQuestion} currentIndex={2} total={5} onSelect={vi.fn()} />);
    expect(screen.getByText('60%')).toBeDefined();
  });

  it('calls onSelect with the option key when an option is clicked', () => {
    const onSelect = vi.fn();
    render(<QuestionView question={mockQuestion} currentIndex={0} total={5} onSelect={onSelect} />);
    // Click the button containing "Paris"
    const parisBtn = screen.getByText('Paris').closest('button')!;
    fireEvent.click(parisBtn);
    expect(onSelect).toHaveBeenCalledWith('B');
  });

  it('applies selected styling to the chosen option', () => {
    render(
      <QuestionView
        question={mockQuestion}
        currentIndex={0}
        total={5}
        selected="B"
        onSelect={vi.fn()}
      />,
    );
    const parisBtn = screen.getByText('Paris').closest('button')!;
    expect(parisBtn.className).toContain('border-accent-500');
  });

  it('does not apply selected styling to unselected options', () => {
    render(
      <QuestionView
        question={mockQuestion}
        currentIndex={0}
        total={5}
        selected="B"
        onSelect={vi.fn()}
      />,
    );
    const berlinBtn = screen.getByText('Berlin').closest('button')!;
    expect(berlinBtn.className).not.toContain('border-accent-500');
  });

  it('renders option key labels (A, B, C, D)', () => {
    render(<QuestionView question={mockQuestion} currentIndex={0} total={5} onSelect={vi.fn()} />);
    // Each option has a key badge rendered as a <span> with exactly that letter
    expect(screen.getByText('A')).toBeDefined();
    expect(screen.getByText('B')).toBeDefined();
    expect(screen.getByText('C')).toBeDefined();
    expect(screen.getByText('D')).toBeDefined();
  });
});
