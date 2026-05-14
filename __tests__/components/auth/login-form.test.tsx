import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LoginForm } from '@/components/auth/login-form';

// Mock next/link to avoid router context requirement
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock next-auth/react so signIn is under our control
const mockSignIn = vi.fn();
vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

// Mock next/navigation for useSearchParams used by CognitoLoginForm
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe('LoginForm – credentials provider', () => {
  const defaultProps = {
    provider: 'credentials' as const,
    hasForgotPassword: true,
    hasRegistration: true,
  };

  it('renders the email and password fields', () => {
    render(<LoginForm {...defaultProps} />);
    expect(screen.getByLabelText(/work email/i)).toBeDefined();
    expect(screen.getByLabelText(/password/i)).toBeDefined();
  });

  it('renders the Sign in button', () => {
    render(<LoginForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDefined();
  });

  it('shows a validation message when submitted with empty fields', () => {
    render(<LoginForm {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText(/please enter your email and password/i)).toBeDefined();
  });

  it('shows a forgot-password link when hasForgotPassword is true', () => {
    render(<LoginForm {...defaultProps} />);
    expect(screen.getByRole('link', { name: /forgot password/i })).toBeDefined();
  });

  it('does not show forgot-password link when hasForgotPassword is false', () => {
    render(<LoginForm {...defaultProps} hasForgotPassword={false} />);
    expect(screen.queryByRole('link', { name: /forgot password/i })).toBeNull();
  });

  it('shows a registration link when hasRegistration is true', () => {
    render(<LoginForm {...defaultProps} />);
    expect(screen.getByRole('link', { name: /create one/i })).toBeDefined();
  });

  it('does not show registration link when hasRegistration is false', () => {
    render(<LoginForm {...defaultProps} hasRegistration={false} />);
    expect(screen.queryByRole('link', { name: /create one/i })).toBeNull();
  });

  it('updates email field on user input', () => {
    render(<LoginForm {...defaultProps} />);
    const emailInput = screen.getByLabelText(/work email/i) as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    expect(emailInput.value).toBe('user@example.com');
  });

  it('updates password field on user input', () => {
    render(<LoginForm {...defaultProps} />);
    const pwInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    fireEvent.change(pwInput, { target: { value: 'secret123' } });
    expect(pwInput.value).toBe('secret123');
  });
});

describe('LoginForm – cognito provider', () => {
  it('shows an SSO redirect message by default (no error param)', () => {
    render(<LoginForm provider="cognito" hasForgotPassword={false} hasRegistration={false} />);
    expect(screen.getByText(/redirecting to sso/i)).toBeDefined();
  });
});
