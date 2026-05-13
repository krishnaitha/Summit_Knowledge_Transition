import type { QuizOptionKey } from '@/lib/types/database';

export function fisherYatesShuffle<T>(items: T[]) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }

  return next;
}

export function normalizeOptionKey(key: string): QuizOptionKey {
  const upper = key.toUpperCase();

  if (upper === 'A' || upper === 'B' || upper === 'C' || upper === 'D') {
    return upper;
  }

  return 'A';
}
