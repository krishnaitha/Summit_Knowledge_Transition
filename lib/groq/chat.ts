import Groq from 'groq-sdk';

import { appEnv, assertEnv, isGroqConfigured } from '@/lib/env';
import { sleep } from '@/lib/utils';

const PRIMARY_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

let groqClient: Groq | null = null;
let groqQuizClient: Groq | null = null;

function getGroqClient(apiKey?: string) {
  if (!isGroqConfigured()) {
    return null;
  }

  // If a specific key is provided, create a one-off client for that key
  if (apiKey) {
    return new Groq({ apiKey });
  }

  if (!groqClient) {
    groqClient = new Groq({ apiKey: assertEnv('groqApiKey') });
  }

  return groqClient;
}

export function getGroqQuizClient(): Groq | null {
  if (!isGroqConfigured()) return null;

  const quizKey = appEnv.groqQuizApiKey;

  // If no dedicated quiz key is configured, fall back to the default client
  if (!quizKey) return getGroqClient();

  if (!groqQuizClient) {
    groqQuizClient = new Groq({ apiKey: quizKey });
  }

  return groqQuizClient;
}

function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = (error as { status?: number }).status;
  return status === 429 || error.message.includes('429') || error.message.toLowerCase().includes('rate limit');
}

export function buildKtPrompt(projectName: string, context: string) {
  return [
    `You are a helpful KT (Knowledge Transfer) assistant for the ${projectName} transition.`,
    'Answer questions ONLY based on the provided context from the KT documents below.',
    'Be clear and practical. If the answer is not in the context, say so clearly.',
    'Always mention which document the answer comes from.',
    '',
    'Context:',
    context,
  ].join('\n');
}

export async function createGroqChatCompletion(
  args: Omit<Parameters<Groq['chat']['completions']['create']>[0], 'model'>,
  onStatus?: (message: string) => void,
  primaryModel?: string,
) {
  const client = getGroqClient();

  if (!client) {
    throw new Error('Groq is not configured. Add GROQ_API_KEY to continue.');
  }

  for (const model of [primaryModel ?? PRIMARY_MODEL, FALLBACK_MODEL]) {
    let attempts = 0;

    while (attempts < 3) {
      try {
        return await client.chat.completions.create({ ...args, model });
      } catch (error) {
        attempts += 1;

        if (attempts >= 3) break;

        if (isRateLimitError(error)) {
          onStatus?.('AI is busy, retrying in 60 seconds…');
          await sleep(60_000);
        } else {
          await sleep(500 * 2 ** attempts);
        }
      }
    }

    if (model === PRIMARY_MODEL) {
      onStatus?.('Switching to backup model…');
    }
  }

  throw new Error(`Groq request failed after all retries. Last error may be a rate limit — wait a minute and try again.`);
}

/**
 * Quiz-generation variant — uses GROQ_API_KEY_QUIZ if set, otherwise falls
 * back to GROQ_API_KEY. Always starts with llama-3.1-8b-instant (131K TPM
 * free tier) so quiz jobs don't compete with chat traffic for rate-limit budget.
 */
export async function createGroqQuizCompletion(
  args: Omit<Parameters<Groq['chat']['completions']['create']>[0], 'model'>,
) {
  const client = getGroqQuizClient();

  if (!client) {
    throw new Error('Groq is not configured. Add GROQ_API_KEY to continue.');
  }

  for (const model of [FALLBACK_MODEL, PRIMARY_MODEL]) {
    let attempts = 0;

    while (attempts < 3) {
      try {
        return await client.chat.completions.create({ ...args, model });
      } catch (error) {
        attempts += 1;

        if (attempts >= 3) break;

        if (isRateLimitError(error)) {
          await sleep(60_000);
        } else {
          await sleep(500 * 2 ** attempts);
        }
      }
    }
  }

  throw new Error(`Groq quiz request failed after all retries. Last error may be a rate limit — wait a minute and try again.`);
}