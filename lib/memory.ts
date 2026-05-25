import type { UserMemoryRecord } from '@/lib/types/database';

export interface ParsedMemoryIntent {
  key: string;
  value: string;
  tags: string[];
  isSensitive: boolean;
  allowsSensitiveStorage: boolean;
}

const SENSITIVE_PATTERNS: RegExp[] = [
  /password/i,
  /passphrase/i,
  /api[_\s-]?key/i,
  /secret/i,
  /token/i,
  /bearer\s+[a-z0-9._-]+/i,
  /private[_\s-]?key/i,
  /ssn|social security/i,
  /credit card|card number|cvv/i,
];

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function slugifyKey(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80);

  return normalized || 'user_preference';
}

function extractTags(input: string): string[] {
  const tags = input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4)
    .slice(0, 8);

  return [...new Set(tags)];
}

function normalizeToken(token: string): string {
  const cleaned = token.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (cleaned.endsWith('ies') && cleaned.length > 3) {
    return `${cleaned.slice(0, -3)}y`;
  }

  if (cleaned.endsWith('s') && cleaned.length > 3) {
    return cleaned.slice(0, -1);
  }

  return cleaned;
}

function tokenize(input: string): string[] {
  return input
    .split(/[^a-z0-9]+/i)
    .map((token) => normalizeToken(token))
    .filter((token) => token.length >= 3);
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => tokens.has(normalizeToken(candidate)));
}

export function containsSensitiveContent(input: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(input));
}

export function parseRememberIntent(message: string): ParsedMemoryIntent | null {
  const normalized = normalizeWhitespace(message);
  const lower = normalized.toLowerCase();

  if (!lower.startsWith('remember ')) {
    return null;
  }

  const allowsSensitiveStorage =
    lower.includes('allow sensitive memory') || lower.includes('allow storing sensitive');

  let payload = normalized.slice('remember '.length).trim();
  payload = payload.replace(/allow sensitive memory/gi, '').trim();

  if (!payload) {
    return null;
  }

  const dividerIndex = payload.indexOf(':');

  if (dividerIndex > 0) {
    const keyPart = normalizeWhitespace(payload.slice(0, dividerIndex));
    const valuePart = normalizeWhitespace(payload.slice(dividerIndex + 1));

    if (!valuePart) return null;

    return {
      key: slugifyKey(keyPart),
      value: valuePart,
      tags: extractTags(`${keyPart} ${valuePart}`),
      isSensitive: containsSensitiveContent(payload),
      allowsSensitiveStorage,
    };
  }

  return {
    key: slugifyKey(payload.slice(0, 60)),
    value: payload,
    tags: extractTags(payload),
    isSensitive: containsSensitiveContent(payload),
    allowsSensitiveStorage,
  };
}

export function parseMemoryConfirmation(message: string): 'confirm' | 'cancel' | null {
  const normalized = normalizeWhitespace(message).toLowerCase();

  if (['yes remember', 'remember yes', 'yes, remember', 'confirm remember'].includes(normalized)) {
    return 'confirm';
  }

  if (['no remember', 'remember no', 'cancel remember', 'no, remember'].includes(normalized)) {
    return 'cancel';
  }

  return null;
}

function relevanceScore(memory: UserMemoryRecord, queryLower: string): number {
  let score = 0;
  const keyLower = memory.memory_key.toLowerCase();
  const valueLower = memory.memory_value.toLowerCase();
  const queryTokens = new Set(tokenize(queryLower));
  const memoryTokens = new Set(
    tokenize(`${memory.memory_key} ${memory.memory_value} ${(memory.tags ?? []).join(' ')}`),
  );

  if (queryLower.includes(keyLower) || keyLower.includes(queryLower)) score += 3;
  if (queryLower.includes(valueLower) || valueLower.includes(queryLower)) score += 4;

  for (const tag of memory.tags ?? []) {
    if (queryLower.includes(tag.toLowerCase())) score += 2;
  }

  let overlap = 0;
  for (const token of queryTokens) {
    if (memoryTokens.has(token)) overlap += 1;
  }
  score += overlap * 1.5;

  if (
    hasAnyToken(queryTokens, ['answer', 'respond', 'reply', 'style', 'tone']) &&
    hasAnyToken(memoryTokens, ['response', 'answer', 'style', 'tone', 'preference'])
  ) {
    score += 4;
  }

  if (
    hasAnyToken(queryTokens, ['prefer', 'preference', 'want']) &&
    hasAnyToken(memoryTokens, ['prefer', 'preference', 'style'])
  ) {
    score += 3;
  }

  score += Number(memory.confidence ?? 0);

  return score;
}

export function selectRelevantMemories(
  memories: UserMemoryRecord[],
  query: string,
  limit = 5,
): UserMemoryRecord[] {
  const queryLower = query.toLowerCase();

  return [...memories]
    .map((memory) => ({ memory, score: relevanceScore(memory, queryLower) }))
    .sort((a, b) => b.score - a.score)
    .filter((row) => row.score > 0)
    .slice(0, Math.max(1, limit))
    .map((row) => row.memory);
}

export function buildMemoryContext(memories: UserMemoryRecord[]): string {
  if (!memories.length) return '';

  const lines = memories.map((memory) => `- ${memory.memory_key}: ${memory.memory_value}`);

  return [
    'User memory (persisted preferences/facts):',
    ...lines,
    'Use these only when relevant to the current question.',
  ].join('\n');
}
