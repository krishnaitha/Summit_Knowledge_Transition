import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Input } from '@/components/ui/input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('forwards placeholder prop', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text') as HTMLInputElement).toBeDefined();
  });

  it('forwards type prop', () => {
    render(<Input type="email" placeholder="email" />);
    const input = screen.getByPlaceholderText('email') as HTMLInputElement;
    expect(input.type).toBe('email');
  });

  it('reflects value changes via onChange', () => {
    const handler = vi.fn();
    render(<Input value="hello" onChange={handler} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('hello');
    fireEvent.change(input, { target: { value: 'world' } });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('merges custom className', () => {
    render(<Input className="custom-class" />);
    expect(screen.getByRole('textbox').className).toContain('custom-class');
  });

  it('retains base styling classes', () => {
    render(<Input />);
    expect(screen.getByRole('textbox').className).toContain('rounded-xl');
  });

  it('forwards autoComplete attribute', () => {
    render(<Input autoComplete="email" />);
    expect((screen.getByRole('textbox') as HTMLInputElement).autocomplete).toBe('email');
  });
});
