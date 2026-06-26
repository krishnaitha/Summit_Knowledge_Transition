export interface PiiViolation {
  type: 'email' | 'ssn' | 'credit_card' | 'phone_number' | 'custom';
  confidence: number;
  matched_text: string;
  position: number;
}

const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  credit_card: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  phone_number: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
};

export function detectPii(text: string): PiiViolation[] {
  const violations: PiiViolation[] = [];
  let match;
  const emailRegex = new RegExp(PII_PATTERNS.email);
  while ((match = emailRegex.exec(text)) !== null) {
    violations.push({ type: 'email', confidence: 0.95, matched_text: match[0], position: match.index });
  }
  const ssnRegex = new RegExp(PII_PATTERNS.ssn);
  while ((match = ssnRegex.exec(text)) !== null) {
    violations.push({ type: 'ssn', confidence: 0.98, matched_text: match[0], position: match.index });
  }
  const ccRegex = new RegExp(PII_PATTERNS.credit_card);
  while ((match = ccRegex.exec(text)) !== null) {
    violations.push({ type: 'credit_card', confidence: 0.9, matched_text: match[0], position: match.index });
  }
  const phoneRegex = new RegExp(PII_PATTERNS.phone_number);
  while ((match = phoneRegex.exec(text)) !== null) {
    violations.push({ type: 'phone_number', confidence: 0.85, matched_text: match[0], position: match.index });
  }
  return violations;
}

export function redactPii(text: string, patterns?: string[]): string {
  let redacted = text;
  const patternsToUse = patterns || Object.keys(PII_PATTERNS) as (keyof typeof PII_PATTERNS)[];
  for (const patternKey of patternsToUse) {
    if (patternKey in PII_PATTERNS) {
      const pattern = PII_PATTERNS[patternKey as keyof typeof PII_PATTERNS];
      redacted = redacted.replace(pattern, (m) => {
        const length = m.length;
        if (length <= 2) return '***';
        return m[0] + '*'.repeat(Math.max(1, length - 2)) + m[length - 1];
      });
    }
  }
  return redacted;
}
