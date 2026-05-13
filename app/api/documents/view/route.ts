import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { logActivity, userHasProjectAccess } from '@/lib/data';
import sql from '@/lib/db';
import { r2, R2_BUCKET } from '@/lib/storage/r2';

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

    const signedUrl = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: document.file_url }),
      { expiresIn: 300 },
    );

    if (!signedUrl) {
      return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 });
    }

    await logActivity({
      userId,
      projectId: document.project_id,
      action: 'document_viewed',
      metadata: { documentId: document.id, fileName: document.file_name },
    });

    const fileExt = document.file_name.split('.').pop()?.toLowerCase() ?? '';
    const officeTypes = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'];

    if (officeTypes.includes(fileExt)) {
      const viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(signedUrl)}`;
      return NextResponse.redirect(viewerUrl);
    }

    return NextResponse.redirect(signedUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 },
    );
  }
}
