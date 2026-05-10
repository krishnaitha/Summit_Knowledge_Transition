import 'server-only';

import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

export async function extractTextFromFile(fileName: string, buffer: Buffer) {
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension === 'pdf') {
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (extension === 'csv') {
    const rows = parse(buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, string>>;

    return rows
      .map((row, i) =>
        `Row ${i + 1}: ` +
        Object.entries(row)
          .map(([col, val]) => `${col}: ${val}`)
          .join(' | '),
      )
      .join('\n');
  }

  if (extension === 'xlsx') {
    const workbook = XLSX.read(buffer);
    return workbook.SheetNames.map((name) => {
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(
        workbook.Sheets[name],
        { defval: '' },
      );
      const rowText = rows
        .map((row, i) =>
          `Row ${i + 1}: ` +
          Object.entries(row)
            .map(([col, val]) => `${col}: ${val}`)
            .join(' | '),
        )
        .join('\n');
      return `Sheet: ${name}\n${rowText}`;
    }).join('\n\n');
  }

  return buffer.toString('utf8');
}