export interface ParseResult {
  text: string;
  pages: number;
  wordCount: number;
  metadata: { format: string; size: number; createdAt?: string };
}

export async function parseDocument(buffer: Buffer, mimeType: string): Promise<ParseResult> {
  const size = buffer.length;
  try {
    switch (mimeType) {
      case 'application/pdf':
        return parsePdf(buffer, size);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return parseDocx(buffer, size);
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
        return parseExcel(buffer, size);
      case 'text/csv':
        return parseCsv(buffer, size);
      case 'text/plain':
        return parseText(buffer, size);
      default:
        throw new Error(`Unsupported MIME type: ${mimeType}`);
    }
  } catch (error) {
    throw new Error(`Failed to parse document: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parsePdf(buffer: Buffer, size: number): ParseResult {
  const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));
  return { text, pages: Math.ceil(text.length / 2000), wordCount: text.split(/\s+/).filter(w => w.length > 0).length, metadata: { format: 'pdf', size } };
}

function parseDocx(buffer: Buffer, size: number): ParseResult {
  const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));
  return { text, pages: 1, wordCount: text.split(/\s+/).filter(w => w.length > 0).length, metadata: { format: 'docx', size } };
}

function parseExcel(buffer: Buffer, size: number): ParseResult {
  const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));
  return { text, pages: 1, wordCount: text.split(/\s+/).filter(w => w.length > 0).length, metadata: { format: 'xlsx', size } };
}

function parseCsv(buffer: Buffer, size: number): ParseResult {
  const text = buffer.toString('utf-8');
  return { text, pages: 1, wordCount: text.split(/\s+/).filter(w => w.length > 0).length, metadata: { format: 'csv', size } };
}

function parseText(buffer: Buffer, size: number): ParseResult {
  const text = buffer.toString('utf-8');
  return { text, pages: 1, wordCount: text.split(/\s+/).filter(w => w.length > 0).length, metadata: { format: 'text', size } };
}
