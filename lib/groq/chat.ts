import Groq from 'groq-sdk';

import { getLlmRuntimeSecrets } from '@/lib/llm/runtime-config';
import { sleep } from '@/lib/utils';

const PRIMARY_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

function buildModelSequence(primary: string, secondary: string) {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const model of [primary, secondary]) {
    const trimmed = model.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    ordered.push(trimmed);
  }

  return ordered;
}

function getGroqClient(apiKey: string): Groq {
  return new Groq({ apiKey });
}

function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = (error as { status?: number }).status;
  return (
    status === 429 ||
    error.message.includes('429') ||
    error.message.toLowerCase().includes('rate limit')
  );
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
  const secrets = await getLlmRuntimeSecrets();
  const client = secrets.groqApiKey ? getGroqClient(secrets.groqApiKey) : null;

  if (!client) {
    throw new Error('Groq is not configured. Add GROQ_API_KEY to continue.');
  }

  for (const model of buildModelSequence(primaryModel ?? PRIMARY_MODEL, FALLBACK_MODEL)) {
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

  throw new Error(
    `Groq request failed after all retries. Last error may be a rate limit — wait a minute and try again.`,
  );
}

/**
 * Quiz-generation variant — uses GROQ_API_KEY_QUIZ if set, otherwise falls
 * back to GROQ_API_KEY. Always starts with llama-3.1-8b-instant (131K TPM
 * free tier) so quiz jobs don't compete with chat traffic for rate-limit budget.
 */
export async function createGroqQuizCompletion(
  args: Omit<Parameters<Groq['chat']['completions']['create']>[0], 'model'>,
  primaryModel?: string,
) {
  const secrets = await getLlmRuntimeSecrets();
  const quizKey = secrets.groqQuizApiKey || secrets.groqApiKey;
  const client = quizKey ? getGroqClient(quizKey) : null;

  if (!client) {
    throw new Error('Groq is not configured. Add GROQ_API_KEY to continue.');
  }

  for (const model of buildModelSequence(primaryModel ?? FALLBACK_MODEL, PRIMARY_MODEL)) {
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

  throw new Error(
    `Groq quiz request failed after all retries. Last error may be a rate limit — wait a minute and try again.`,
  );
}
