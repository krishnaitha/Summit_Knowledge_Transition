import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { getProfileById, logActivity, userHasProjectAccess } from '@/lib/data';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'documentId required' }, { status: 400 });
    }

    const supabase = createServiceRoleSupabaseClient();
    const { user } = await getCurrentUserContext();

    if (!supabase || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileById(user.id);

    const { data: document } = await supabase
      .from('documents')
      .select('id, file_name, file_url, project_id')
      .eq('id', documentId)
      .maybeSingle();

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const canAccess = await userHasProjectAccess(user.id, profile?.role, document.project_id);

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: signed } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.file_url, 300, { download: false });

    if (!signed?.signedUrl) {
      return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 });
    }

    await logActivity({
      userId: user.id,
      projectId: document.project_id,
      action: 'document_viewed',
      metadata: { documentId: document.id, fileName: document.file_name },
    });

    const fileExt = document.file_name.split('.').pop()?.toLowerCase() ?? '';
    const officeTypes = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'];

    if (officeTypes.includes(fileExt)) {
      const viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(signed.signedUrl)}`;
      return NextResponse.redirect(viewerUrl);
    }

    return NextResponse.redirect(signed.signedUrl);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
