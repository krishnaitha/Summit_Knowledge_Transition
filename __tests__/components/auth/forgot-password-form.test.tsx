import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('ForgotPasswordForm', () => {
  it('renders the email field and submit button', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/work email/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeDefined();
  });

  it('renders the heading', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByRole('heading', { name: /reset your password/i })).toBeDefined();
  });

  it('shows validation error when submitted with an empty email', () => {
    render(<ForgotPasswordForm />);
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(screen.getByText(/please enter your email address/i)).toBeDefined();
  });

  it('shows a back-to-sign-in link', () => {
    render(<ForgotPasswordForm />);
    const link = screen.getByRole('link', { name: /sign in/i }) as HTMLAnchorElement;
    expect(link.href).toContain('/login');
  });

  it('shows success message after valid email submission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await vi.waitFor(() => {
      expect(screen.getByText(/password reset link has been sent/i)).toBeDefined();
    });

    vi.unstubAllGlobals();
  });

  it('shows an error message when the API call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'User not found' }),
      }),
    );

    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'unknown@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await vi.waitFor(() => {
      expect(screen.getByText(/user not found/i)).toBeDefined();
    });

    vi.unstubAllGlobals();
  });

  it('updates email field on user input', () => {
    render(<ForgotPasswordForm />);
    const input = screen.getByLabelText(/work email/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'me@example.com' } });
    expect(input.value).toBe('me@example.com');
  });
});
