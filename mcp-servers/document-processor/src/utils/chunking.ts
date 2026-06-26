export interface Chunk {
  text: string;
  startIdx: number;
  endIdx: number;
  chunkIdx: number;
}

export function chunkText(text: string, chunkSize = 1000, overlapSize = 100): Chunk[] {
  if (!text || text.length === 0) return [];
  const chunks: Chunk[] = [];
  let currentIdx = 0;
  let chunkIdx = 0;
  while (currentIdx < text.length) {
    let endIdx = Math.min(currentIdx + chunkSize, text.length);
    if (endIdx < text.length) {
      const lookAheadEnd = Math.min(currentIdx + chunkSize + 100, text.length);
      const searchText = text.substring(currentIdx, lookAheadEnd);
      const lastSentence = Math.max(searchText.lastIndexOf('.'), searchText.lastIndexOf('!'), searchText.lastIndexOf('?'));
      if (lastSentence > chunkSize * 0.7) {
        endIdx = currentIdx + lastSentence + 1;
      }
    }
    const chunkTextContent = text.substring(currentIdx, endIdx).trim();
    if (chunkTextContent.length > 0) {
      chunks.push({ text: chunkTextContent, startIdx: currentIdx, endIdx, chunkIdx });
      chunkIdx++;
    }
    currentIdx = Math.max(currentIdx + chunkSize - overlapSize, endIdx - overlapSize);
    if (currentIdx >= text.length - 100) break;
  }
  return chunks;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
