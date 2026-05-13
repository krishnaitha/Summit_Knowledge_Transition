import 'server-only';

export interface PiiResult {
  redactedText: string;
  count: number;
  types: string[];
}

const PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'email', regex: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g },
  { name: 'phone', regex: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { name: 'ssn', regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g },
  { name: 'credit_card', regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
];

export function redactPii(text: string): PiiResult {
  let redactedText = text;
  let count = 0;
  const types: string[] = [];

  for (const { name, regex } of PATTERNS) {
    const matches = redactedText.match(regex);
    if (matches?.length) {
      count += matches.length;
      types.push(name);
      redactedText = redactedText.replace(regex, '[REDACTED]');
    }
  }

  return { redactedText, count, types };
}
