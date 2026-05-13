const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 50;

export interface TextChunk {
  chunkIndex: number;
  content: string;
}

export function chunkDocumentText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP,
) {
  const tokens = text.replace(/\s+/g, ' ').trim().split(' ');

  if (!tokens.filter(Boolean).length) {
    return [] as TextChunk[];
  }

  const chunks: TextChunk[] = [];
  let index = 0;

  for (let cursor = 0; cursor < tokens.length; cursor += chunkSize - overlap) {
    const content = tokens
      .slice(cursor, cursor + chunkSize)
      .join(' ')
      .trim();

    if (!content) {
      continue;
    }

    chunks.push({
      chunkIndex: index,
      content,
    });

    index += 1;
  }

  return chunks;
}
