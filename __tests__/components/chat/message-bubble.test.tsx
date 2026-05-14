import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ChatBubbleMessage } from '@/components/chat/message-bubble';
import { MessageBubble } from '@/components/chat/message-bubble';

// Stub heavy sub-components that involve fetch / server actions
vi.mock('@/components/chat/bookmark-button', () => ({
  BookmarkButton: ({ initialIsBookmarked }: { initialIsBookmarked: boolean }) => (
    <button aria-label={initialIsBookmarked ? 'Remove bookmark' : 'Bookmark this answer'}>
      Bookmark
    </button>
  ),
}));

vi.mock('@/components/chat/feedback-buttons', () => ({
  FeedbackButtons: () => <div data-testid="feedback-buttons">Feedback</div>,
}));

const userMessage: ChatBubbleMessage = {
  id: 'msg-user-1',
  role: 'user',
  content: 'What is Next.js?',
};

const assistantMessage: ChatBubbleMessage = {
  id: 'msg-ai-1',
  role: 'assistant',
  content: 'Next.js is a React framework for production.',
  sources: [
    { documentName: 'Next.js Docs', similarity: 0.9 },
    { documentName: 'React Guide', similarity: 0.4 },
  ],
};

describe('MessageBubble – user message', () => {
  it('renders the message content', () => {
    render(<MessageBubble message={userMessage} />);
    expect(screen.getByText('What is Next.js?')).toBeDefined();
  });

  it('aligns user message to the right (justify-end)', () => {
    const { container } = render(<MessageBubble message={userMessage} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('justify-end');
  });

  it('applies brand-700 background for user message', () => {
    const { container } = render(<MessageBubble message={userMessage} />);
    const bubble = (container.firstChild as HTMLElement).firstChild as HTMLElement;
    expect(bubble.className).toContain('bg-brand-700');
  });

  it('does not render source tags for user messages', () => {
    render(<MessageBubble message={userMessage} />);
    expect(screen.queryByText(/next\.js docs/i)).toBeNull();
  });

  it('does not render bookmark button for user messages', () => {
    render(<MessageBubble message={userMessage} projectId="proj-1" isBookmarked={false} />);
    expect(screen.queryByRole('button', { name: /bookmark/i })).toBeNull();
  });
});

describe('MessageBubble – assistant message', () => {
  it('renders the message content', () => {
    render(<MessageBubble message={assistantMessage} />);
    expect(screen.getByText('Next.js is a React framework for production.')).toBeDefined();
  });

  it('aligns assistant message to the left (justify-start)', () => {
    const { container } = render(<MessageBubble message={assistantMessage} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('justify-start');
  });

  it('applies white background for assistant message', () => {
    const { container } = render(<MessageBubble message={assistantMessage} />);
    const bubble = (container.firstChild as HTMLElement).firstChild as HTMLElement;
    expect(bubble.className).toContain('bg-white');
  });

  it('renders source tags when assistant has sources', () => {
    render(<MessageBubble message={assistantMessage} />);
    expect(screen.getByText(/next\.js docs/i)).toBeDefined();
    expect(screen.getByText(/react guide/i)).toBeDefined();
  });

  it('does not render source tags when sources array is empty', () => {
    const msg: ChatBubbleMessage = { ...assistantMessage, sources: [] };
    render(<MessageBubble message={msg} />);
    expect(screen.queryByText(/next\.js docs/i)).toBeNull();
  });

  it('does not render source tags when sources is null', () => {
    const msg: ChatBubbleMessage = { ...assistantMessage, sources: null };
    render(<MessageBubble message={msg} />);
    expect(screen.queryByText(/next\.js docs/i)).toBeNull();
  });

  it('shows bookmark button for persisted assistant messages with a projectId', () => {
    render(<MessageBubble message={assistantMessage} projectId="proj-1" isBookmarked={false} />);
    expect(screen.getByRole('button', { name: /bookmark/i })).toBeDefined();
  });

  it('does not show bookmark button for streamed messages', () => {
    const streamedMsg: ChatBubbleMessage = { ...assistantMessage, isStreamed: true };
    render(<MessageBubble message={streamedMsg} projectId="proj-1" isBookmarked={false} />);
    expect(screen.queryByRole('button', { name: /bookmark/i })).toBeNull();
  });

  it('does not show bookmark button when projectId is absent', () => {
    render(<MessageBubble message={assistantMessage} isBookmarked={false} />);
    expect(screen.queryByRole('button', { name: /bookmark/i })).toBeNull();
  });

  it('shows feedback buttons alongside bookmark for persisted assistant messages', () => {
    render(<MessageBubble message={assistantMessage} projectId="proj-1" isBookmarked={false} />);
    expect(screen.getByTestId('feedback-buttons')).toBeDefined();
  });
});
