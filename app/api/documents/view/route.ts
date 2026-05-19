import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { logActivity, userHasProjectAccess } from '@/lib/data';
import sql from '@/lib/db';
import { downloadFile } from '@/lib/storage/local';
import { downloadFromR2 } from '@/lib/storage/r2';

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'documentId required' }, { status: 400 });
    }

    const { userId, profile } = await getCurrentUserContext();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const docs = await sql`
      SELECT id, file_name, file_url, project_id
      FROM documents
      WHERE id = ${documentId}
    `;
    const document = docs[0] ?? null;

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const canAccess = await userHasProjectAccess(userId, profile?.role, document.project_id);

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let fileBuffer: Buffer;

    try {
      fileBuffer = await downloadFile(document.file_url);
    } catch {
      try {
        const fileStream = await downloadFromR2(document.file_url);
        fileBuffer = await streamToBuffer(fileStream);
      } catch {
        return NextResponse.json({ error: 'Document file unavailable' }, { status: 404 });
      }
    }

    await logActivity({
      userId,
      projectId: document.project_id,
      action: 'document_viewed',
      metadata: { documentId: document.id, fileName: document.file_name },
    });

    const fileExt = document.file_name.split('.').pop()?.toLowerCase() ?? '';
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      txt: 'text/plain',
      csv: 'text/csv',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
    };

    const mimeType = mimeTypes[fileExt] || 'application/octet-stream';
    const officeTypes = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'];

    // For Office documents, provide a direct download (not viewable inline)
    // For PDFs and text, allow inline viewing
    const contentDisposition = officeTypes.includes(fileExt)
      ? `attachment; filename="${encodeURIComponent(document.file_name)}"`
      : 'inline';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed';
    const status = message === 'Document not found' ? 404 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
