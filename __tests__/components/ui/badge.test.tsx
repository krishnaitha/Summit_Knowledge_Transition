import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeDefined();
  });

  it('applies neutral variant classes by default', () => {
    render(<Badge>Neutral</Badge>);
    expect(screen.getByText('Neutral').className).toContain('bg-slate-100');
    expect(screen.getByText('Neutral').className).toContain('text-slate-700');
  });

  it('applies success variant classes', () => {
    render(<Badge variant="success">Passed</Badge>);
    const el = screen.getByText('Passed');
    expect(el.className).toContain('bg-emerald-100');
    expect(el.className).toContain('text-emerald-700');
  });

  it('applies warning variant classes', () => {
    render(<Badge variant="warning">Pending</Badge>);
    const el = screen.getByText('Pending');
    expect(el.className).toContain('bg-amber-100');
    expect(el.className).toContain('text-amber-700');
  });

  it('applies danger variant classes', () => {
    render(<Badge variant="danger">Failed</Badge>);
    const el = screen.getByText('Failed');
    expect(el.className).toContain('bg-rose-100');
    expect(el.className).toContain('text-rose-700');
  });

  it('applies info variant classes', () => {
    render(<Badge variant="info">New</Badge>);
    const el = screen.getByText('New');
    expect(el.className).toContain('bg-brand-100');
    expect(el.className).toContain('text-brand-700');
  });

  it('merges custom className', () => {
    render(<Badge className="shrink-0">Tag</Badge>);
    expect(screen.getByText('Tag').className).toContain('shrink-0');
  });

  it('renders as a span element', () => {
    const { container } = render(<Badge>Span</Badge>);
    expect(container.querySelector('span')).toBeDefined();
  });
});
