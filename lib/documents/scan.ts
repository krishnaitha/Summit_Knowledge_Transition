import 'server-only';

export type DocumentClassification = 'confidential' | 'internal' | 'public';

export interface ScanResult {
  classification: DocumentClassification;
  scanFlags: string[];
}

const SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'aws_key', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'api_key', regex: /\b(api[_-]?key|apikey|bearer)\s*[:=]\s*[a-zA-Z0-9_-]{20,}/gi },
  { name: 'password', regex: /\b(password|passwd|pwd)\s*[:=]\s*\S+/gi },
  { name: 'connection', regex: /\b(postgres|mysql|mongodb|redis):\/\/[^\s]+/gi },
  { name: 'secret_token', regex: /\b(secret|token)\s*[:=]\s*[^\s]{8,}/gi },
];

const INTERNAL_PATTERNS = [
  /\binternal use only\b/i,
  /\bdo not distribute\b/i,
  /\bproprietary\b/i,
  /\bconfidential\b/i,
];

export function scanDocument(text: string, piiDetected: boolean): ScanResult {
  const scanFlags: string[] = [];

  for (const { name, regex } of SECRET_PATTERNS) {
    // Reset lastIndex since we reuse compiled regexes with the /g flag
    regex.lastIndex = 0;
    if (regex.test(text)) scanFlags.push(name);
  }

  let classification: DocumentClassification = 'public';

  if (piiDetected || scanFlags.length > 0) {
    classification = 'confidential';
  } else if (INTERNAL_PATTERNS.some((p) => p.test(text))) {
    classification = 'internal';
  }

  return { classification, scanFlags };
}
