import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clientEnv } from '@/lib/env.client';

describe('clientEnv defaults', () => {
  it('exports appName as a non-empty string', () => {
    expect(typeof clientEnv.appName).toBe('string');
    expect(clientEnv.appName.length).toBeGreaterThan(0);
  });

  it('exports appUrl as a non-empty string', () => {
    expect(typeof clientEnv.appUrl).toBe('string');
    expect(clientEnv.appUrl.length).toBeGreaterThan(0);
  });

  it('exports botName as a non-empty string', () => {
    expect(typeof clientEnv.botName).toBe('string');
    expect(clientEnv.botName.length).toBeGreaterThan(0);
  });

  it('appName falls back to "NextElevate"', () => {
    expect(clientEnv.appName).toBe('NextElevate');
  });

  it('appUrl falls back to "http://localhost:3000"', () => {
    expect(clientEnv.appUrl).toBe('http://localhost:3000');
  });

  it('botName is derived from the default appName when NEXT_PUBLIC_BOT_NAME is absent', () => {
    expect(clientEnv.botName).toBe('NextElevate AI');
  });
});

describe('clientEnv env-var overrides', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it('uses NEXT_PUBLIC_APP_NAME when set', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_NAME', 'Acme Portal');
    const { clientEnv: env } = await import('@/lib/env.client');
    expect(env.appName).toBe('Acme Portal');
  });

  it('uses NEXT_PUBLIC_APP_URL when set', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.acme.example.com');
    const { clientEnv: env } = await import('@/lib/env.client');
    expect(env.appUrl).toBe('https://app.acme.example.com');
  });

  it('uses NEXT_PUBLIC_BOT_NAME when set, ignoring appName', async () => {
    vi.stubEnv('NEXT_PUBLIC_BOT_NAME', 'My Custom Bot');
    const { clientEnv: env } = await import('@/lib/env.client');
    expect(env.botName).toBe('My Custom Bot');
  });

  it('derives botName from NEXT_PUBLIC_APP_NAME when NEXT_PUBLIC_BOT_NAME is absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_NAME', 'Acme Portal');
    const { clientEnv: env } = await import('@/lib/env.client');
    expect(env.botName).toBe('Acme Portal AI');
  });
});

