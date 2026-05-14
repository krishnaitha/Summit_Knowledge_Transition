import { afterEach, describe, expect, it } from 'vitest';

import {
  appEnv,
  assertEnv,
  isCopilotProxyConfigured,
  isDatabaseConfigured,
  isGroqConfigured,
  isLlmConfigured,
  isR2Configured,
} from '@/lib/env';

// Snapshot original values so every test starts clean.
const original = { ...appEnv };
afterEach(() => Object.assign(appEnv, original));

// ---------------------------------------------------------------------------
// isDatabaseConfigured
// ---------------------------------------------------------------------------
describe('isDatabaseConfigured', () => {
  it('returns true when databaseUrl is set', () => {
    appEnv.databaseUrl = 'postgres://localhost:5432/test';
    expect(isDatabaseConfigured()).toBe(true);
  });

  it('returns false when databaseUrl is undefined', () => {
    appEnv.databaseUrl = undefined;
    expect(isDatabaseConfigured()).toBe(false);
  });

  it('returns false when databaseUrl is an empty string', () => {
    appEnv.databaseUrl = '' as string | undefined;
    expect(isDatabaseConfigured()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isR2Configured  (storage provider detection)
// ---------------------------------------------------------------------------
describe('isR2Configured', () => {
  it('returns true when both R2_ACCOUNT_ID and R2_BUCKET_NAME are set', () => {
    appEnv.r2AccountId = 'acc-123';
    appEnv.r2BucketName = 'my-bucket';
    expect(isR2Configured()).toBe(true);
  });

  it('returns false when R2_ACCOUNT_ID is missing', () => {
    appEnv.r2AccountId = undefined;
    appEnv.r2BucketName = 'my-bucket';
    expect(isR2Configured()).toBe(false);
  });

  it('returns false when R2_BUCKET_NAME is missing', () => {
    appEnv.r2AccountId = 'acc-123';
    appEnv.r2BucketName = undefined;
    expect(isR2Configured()).toBe(false);
  });

  it('returns false when both are missing', () => {
    appEnv.r2AccountId = undefined;
    appEnv.r2BucketName = undefined;
    expect(isR2Configured()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isGroqConfigured  (LLM provider – Groq)
// ---------------------------------------------------------------------------
describe('isGroqConfigured', () => {
  it('returns true when groqApiKey is set', () => {
    appEnv.groqApiKey = 'sk-groq-test-key';
    expect(isGroqConfigured()).toBe(true);
  });

  it('returns false when groqApiKey is undefined', () => {
    appEnv.groqApiKey = undefined;
    expect(isGroqConfigured()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isCopilotProxyConfigured  (LLM provider – Copilot)
// ---------------------------------------------------------------------------
describe('isCopilotProxyConfigured', () => {
  it('returns true when copilotProxyToken is set', () => {
    appEnv.copilotProxyToken = 'ghp_test_token';
    expect(isCopilotProxyConfigured()).toBe(true);
  });

  it('returns false when copilotProxyToken is undefined', () => {
    appEnv.copilotProxyToken = undefined;
    expect(isCopilotProxyConfigured()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isLlmConfigured  (routes based on LLM_PROVIDER)
// ---------------------------------------------------------------------------
describe('isLlmConfigured', () => {
  it('returns true for "groq" provider when groqApiKey is set', () => {
    appEnv.llmProvider = 'groq';
    appEnv.groqApiKey = 'sk-groq-key';
    expect(isLlmConfigured()).toBe(true);
  });

  it('returns false for "groq" provider when groqApiKey is missing', () => {
    appEnv.llmProvider = 'groq';
    appEnv.groqApiKey = undefined;
    expect(isLlmConfigured()).toBe(false);
  });

  it('returns true for "copilot" provider when copilotProxyToken is set', () => {
    appEnv.llmProvider = 'copilot';
    appEnv.copilotProxyToken = 'ghp_token';
    expect(isLlmConfigured()).toBe(true);
  });

  it('returns false for "copilot" provider when copilotProxyToken is missing', () => {
    appEnv.llmProvider = 'copilot';
    appEnv.copilotProxyToken = undefined;
    expect(isLlmConfigured()).toBe(false);
  });

  it('does NOT require copilotProxyToken when provider is "groq"', () => {
    appEnv.llmProvider = 'groq';
    appEnv.groqApiKey = 'sk-groq-key';
    appEnv.copilotProxyToken = undefined; // should be irrelevant
    expect(isLlmConfigured()).toBe(true);
  });

  it('does NOT require groqApiKey when provider is "copilot"', () => {
    appEnv.llmProvider = 'copilot';
    appEnv.copilotProxyToken = 'ghp_token';
    appEnv.groqApiKey = undefined; // should be irrelevant
    expect(isLlmConfigured()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// assertEnv
// ---------------------------------------------------------------------------
describe('assertEnv', () => {
  it('returns the value when the key is set', () => {
    appEnv.nextauthSecret = 'super-secret-value';
    expect(assertEnv('nextauthSecret')).toBe('super-secret-value');
  });

  it('throws an error mentioning the key name when the value is undefined', () => {
    appEnv.nextauthSecret = undefined;
    expect(() => assertEnv('nextauthSecret')).toThrow('nextauthSecret');
  });

  it('throws when the value is an empty string', () => {
    appEnv.nextauthSecret = '' as string | undefined;
    expect(() => assertEnv('nextauthSecret')).toThrow();
  });

  it('does not throw for keys that have a truthy value', () => {
    appEnv.databaseUrl = 'postgres://localhost/db';
    expect(() => assertEnv('databaseUrl')).not.toThrow();
  });
});
