import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

describe('Card', () => {
  it('renders children inside a div', () => {
    const { container } = render(<Card>Card body</Card>);
    expect(container.querySelector('div')).toBeDefined();
    expect(screen.getByText('Card body')).toBeDefined();
  });

  it('applies base rounded/shadow classes', () => {
    const { container } = render(<Card>content</Card>);
    expect((container.firstChild as HTMLElement).className).toContain('rounded-3xl');
  });

  it('merges custom className', () => {
    const { container } = render(<Card className="flex flex-col">content</Card>);
    expect((container.firstChild as HTMLElement).className).toContain('flex');
    expect((container.firstChild as HTMLElement).className).toContain('flex-col');
  });
});

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText('Header')).toBeDefined();
  });

  it('applies flex-col layout classes', () => {
    const { container } = render(<CardHeader>H</CardHeader>);
    expect((container.firstChild as HTMLElement).className).toContain('flex-col');
  });
});

describe('CardTitle', () => {
  it('renders as an h3 element', () => {
    render(<CardTitle>Project Alpha</CardTitle>);
    expect(screen.getByRole('heading', { level: 3, name: 'Project Alpha' })).toBeDefined();
  });

  it('applies semibold text class', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByRole('heading').className).toContain('font-semibold');
  });
});

describe('CardDescription', () => {
  it('renders as a paragraph', () => {
    const { container } = render(<CardDescription>A description</CardDescription>);
    expect(container.querySelector('p')).toBeDefined();
    expect(screen.getByText('A description')).toBeDefined();
  });
});

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent>Body content</CardContent>);
    expect(screen.getByText('Body content')).toBeDefined();
  });
});
