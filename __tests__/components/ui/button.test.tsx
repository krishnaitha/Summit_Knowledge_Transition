import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeDefined();
  });

  it('applies primary variant classes by default', () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-brand-700');
  });

  it('applies secondary variant classes', () => {
    render(<Button variant="secondary">Cancel</Button>);
    expect(screen.getByRole('button').className).toContain('bg-white');
    expect(screen.getByRole('button').className).toContain('text-brand-700');
  });

  it('applies ghost variant classes', () => {
    render(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button').className).toContain('text-slate-600');
  });

  it('applies danger variant classes', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button').className).toContain('bg-rose-600');
  });

  it('applies sm size classes', () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button').className).toContain('h-9');
  });

  it('applies lg size classes', () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button').className).toContain('h-12');
  });

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('disabled button has reduced-opacity class', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button').className).toContain('disabled:opacity-60');
  });

  it('calls onClick when clicked', () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('has disabled:cursor-not-allowed and disabled:opacity-60 utility classes', () => {
    render(<Button disabled>Disabled</Button>);
    // Tailwind utility classes are present in the className string regardless of CSS processing
    expect(screen.getByRole('button').className).toContain('disabled:cursor-not-allowed');
    expect(screen.getByRole('button').className).toContain('disabled:opacity-60');
  });

  it('merges custom className', () => {
    render(<Button className="w-full">Full</Button>);
    expect(screen.getByRole('button').className).toContain('w-full');
  });

  it('forwards type attribute', () => {
    render(<Button type="submit">Submit</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).type).toBe('submit');
  });
});
