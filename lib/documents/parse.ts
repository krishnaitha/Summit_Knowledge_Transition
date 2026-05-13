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

  if (extension === 'pptx' || extension === 'ppt') {
    // XLSX library can read PowerPoint slide text via the Sheets API
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const slides = workbook.SheetNames.map((name, i) => {
      const sheet = workbook.Sheets[name];
      const text = XLSX.utils.sheet_to_txt(sheet).trim();
      return `Slide ${i + 1} (${name}):\n${text}`;
    }).filter((s) => s.includes('\n'));

    return slides.length > 0
      ? slides.join('\n\n')
      : '[No extractable text found in presentation]';
  }

  return buffer.toString('utf8');
}