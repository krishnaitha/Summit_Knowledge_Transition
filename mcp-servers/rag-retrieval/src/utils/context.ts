import type { RetrievedChunk } from './retrieval.js';

export interface BuiltContext {
  context: string;
  sources: Array<{ document_name: string; document_id: string; chunk_index: number; similarity: number }>;
  total_tokens: number;
  chunks_used: number;
}

export function buildContext(chunks: RetrievedChunk[], maxTokens = 3000): BuiltContext {
  const sources: BuiltContext['sources'] = [];
  const parts: string[] = [];
  let totalChars = 0;
  const maxChars = maxTokens * 4;
  for (const chunk of chunks) {
    const part = `[Source: ${chunk.document_name}]\n${chunk.content}`;
    if (totalChars + part.length > maxChars) break;
    parts.push(part);
    totalChars += part.length;
    sources.push({ document_name: chunk.document_name, document_id: chunk.document_id, chunk_index: chunk.chunk_index, similarity: Math.round(chunk.similarity * 1000) / 1000 });
  }
  return { context: parts.join('\n\n---\n\n'), sources, total_tokens: Math.ceil(totalChars / 4), chunks_used: parts.length };
}

export function rerankChunks(chunks: RetrievedChunk[], query: string): RetrievedChunk[] {
  const queryWords = new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  return [...chunks].sort((a, b) => {
    let scoreA = a.similarity, scoreB = b.similarity;
    const wordsA = a.content.toLowerCase(), wordsB = b.content.toLowerCase();
    for (const word of queryWords) {
      if (wordsA.includes(word)) scoreA += 0.02;
      if (wordsB.includes(word)) scoreB += 0.02;
    }
    return scoreB - scoreA;
  });
}
