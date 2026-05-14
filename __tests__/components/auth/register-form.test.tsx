import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RegisterForm } from '@/components/auth/register-form';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('RegisterForm', () => {
  it('renders all form fields', () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(/full name/i)).toBeDefined();
    expect(screen.getByLabelText(/work email/i)).toBeDefined();
    // Two password fields exist – use getAllByLabelText
    expect(screen.getByLabelText(/^password/i)).toBeDefined();
    expect(screen.getByLabelText(/confirm password/i)).toBeDefined();
  });

  it('renders the Create account button', () => {
    render(<RegisterForm />);
    expect(screen.getByRole('button', { name: /create account/i })).toBeDefined();
  });

  it('shows error when full name is empty on submit', () => {
    render(<RegisterForm />);
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText(/please enter your full name/i)).toBeDefined();
  });

  it('shows error when email is empty on submit', () => {
    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText(/please enter your email address/i)).toBeDefined();
  });

  it('shows error when password is shorter than 8 characters', () => {
    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText(/password must be at least 8 characters/i)).toBeDefined();
  });

  it('shows error when passwords do not match', () => {
    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'different456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText(/passwords do not match/i)).toBeDefined();
  });

  it('shows link to sign in page', () => {
    render(<RegisterForm />);
    const link = screen.getByRole('link', { name: /sign in/i }) as HTMLAnchorElement;
    expect(link.href).toContain('/login');
  });

  it('shows success message and sign-in link after successful registration', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    // Wait for the async transition to resolve
    await vi.waitFor(() => {
      expect(screen.getByText(/account created successfully/i)).toBeDefined();
    });

    vi.unstubAllGlobals();
  });

  it('shows API error message on failed registration', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Email already exists' }),
      }),
    );

    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await vi.waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeDefined();
    });

    vi.unstubAllGlobals();
  });
});
