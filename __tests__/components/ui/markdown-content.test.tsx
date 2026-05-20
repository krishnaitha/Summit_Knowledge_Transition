import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownContent } from '@/components/ui/markdown-content';

describe('MarkdownContent – plain text', () => {
  it('renders plain text content', () => {
    render(<MarkdownContent content="Hello world" />);
    expect(screen.getByText('Hello world')).toBeDefined();
  });

  it('renders empty string without crashing', () => {
    const { container } = render(<MarkdownContent content="" />);
    expect(container.firstChild).toBeDefined();
  });
});

describe('MarkdownContent – markdown elements', () => {
  it('renders bold text as <strong>', () => {
    render(<MarkdownContent content="**Bold text**" />);
    const strong = document.querySelector('strong');
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe('Bold text');
  });

  it('renders italic text as <em>', () => {
    render(<MarkdownContent content="_italic text_" />);
    const em = document.querySelector('em');
    expect(em).toBeTruthy();
    expect(em?.textContent).toBe('italic text');
  });

  it('renders inline code as <code>', () => {
    render(<MarkdownContent content="`someCode()`" />);
    const code = document.querySelector('code');
    expect(code).toBeTruthy();
    expect(code?.textContent).toBe('someCode()');
  });

  it('renders an unordered list with the correct number of items', () => {
    render(<MarkdownContent content={'- Item one\n- Item two\n- Item three'} />);
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(3);
  });

  it('renders an ordered list as <ol>', () => {
    render(<MarkdownContent content={'1. First\n2. Second'} />);
    const ol = document.querySelector('ol');
    expect(ol).toBeTruthy();
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(2);
  });

  it('renders a heading', () => {
    render(<MarkdownContent content="## Section Title" />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe('Section Title');
  });
});

describe('MarkdownContent size="sm"', () => {
  it('applies text-sm class on the wrapper', () => {
    const { container } = render(<MarkdownContent content="text" size="sm" />);
    expect((container.firstChild as HTMLElement).className).toContain('text-sm');
  });

  it('applies leading-5 class on the wrapper', () => {
    const { container } = render(<MarkdownContent content="text" size="sm" />);
    expect((container.firstChild as HTMLElement).className).toContain('leading-5');
  });

  it('does NOT apply prose class for sm size', () => {
    const { container } = render(<MarkdownContent content="text" size="sm" />);
    expect((container.firstChild as HTMLElement).className).not.toContain('prose');
  });

  it('still renders markdown content', () => {
    render(<MarkdownContent content="**Bold**" size="sm" />);
    expect(document.querySelector('strong')).toBeTruthy();
  });
});

describe('MarkdownContent size="base"', () => {
  it('applies prose class on the wrapper', () => {
    const { container } = render(<MarkdownContent content="text" size="base" />);
    expect((container.firstChild as HTMLElement).className).toContain('prose');
  });

  it('defaults to size="base" when size prop is omitted', () => {
    const { container } = render(<MarkdownContent content="text" />);
    expect((container.firstChild as HTMLElement).className).toContain('prose');
  });

  it('does NOT apply text-sm class for base size', () => {
    const { container } = render(<MarkdownContent content="text" size="base" />);
    expect((container.firstChild as HTMLElement).className).not.toContain('text-sm');
  });
});
