export type SensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted';

export interface SensitivityResult {
  level: SensitivityLevel;
  confidence: number;
  indicators: string[];
}

const RESTRICTED_KEYWORDS = ['top secret', 'classified', 'proprietary', 'trade secret', 'do not distribute', 'strictly confidential'];
const CONFIDENTIAL_KEYWORDS = ['confidential', 'private', 'sensitive', 'restricted', 'for authorized users only'];
const INTERNAL_KEYWORDS = ['internal', 'staff only', 'team', 'company'];

export function scanSensitivity(text: string): SensitivityResult {
  const textLower = text.toLowerCase();
  const indicators: string[] = [];
  let maxLevel: SensitivityLevel = 'public';
  let confidence = 0.5;

  for (const kw of RESTRICTED_KEYWORDS) {
    if (textLower.includes(kw)) {
      indicators.push(kw);
      maxLevel = 'restricted';
      confidence = Math.min(1, confidence + 0.2);
    }
  }
  if ((maxLevel as string) !== 'restricted') {
    for (const kw of CONFIDENTIAL_KEYWORDS) {
      if (textLower.includes(kw)) {
        indicators.push(kw);
        if ((maxLevel as string) === 'public' || (maxLevel as string) === 'internal') maxLevel = 'confidential';
        confidence = Math.min(1, confidence + 0.15);
      }
    }
  }
  if ((maxLevel as string) === 'public') {
    for (const kw of INTERNAL_KEYWORDS) {
      if (textLower.includes(kw)) {
        indicators.push(kw);
        maxLevel = 'internal';
        confidence = Math.min(1, confidence + 0.1);
      }
    }
  }
  return { level: maxLevel, confidence: Math.min(1, confidence), indicators: [...new Set(indicators)] };
}
