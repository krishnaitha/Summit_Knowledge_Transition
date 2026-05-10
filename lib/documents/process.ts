import 'server-only';

import { logActivity } from '@/lib/data';
import { redactPii } from '@/lib/documents/pii';
import { scanDocument } from '@/lib/documents/scan';
import { chunkDocumentText } from '@/lib/rag/chunking';
import { embedText } from '@/lib/rag/embeddings';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export async function processDocumentRecord(documentId: string, projectId: string, content: string) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    throw new Error('Supabase service role is not configured.');
  }

  // Redact PII and scan for secrets before chunking
  const pii = redactPii(content);
  const scan = scanDocument(content, pii.count > 0);
  const cleanContent = pii.redactedText;

  const chunks = chunkDocumentText(cleanContent);
  const embeddings = await Promise.all(chunks.map((chunk) => embedText(chunk.content)));

  const payload = chunks.map((chunk, index) => ({
    document_id: documentId,
    project_id: projectId,
    content: chunk.content,
    chunk_index: chunk.chunkIndex,
    embedding: embeddings[index],
  }));

  if (payload.length) {
    const { error: insertError } = await supabase.from('document_chunks').insert(payload);

    if (insertError) {
      throw insertError;
    }
  }

  const { error: updateError } = await supabase
    .from('documents')
    .update({
      chunk_count: payload.length,
      pii_detections: pii.count,
      classification: scan.classification,
      scan_flags: scan.scanFlags,
    })
    .eq('id', documentId);

  if (updateError) {
    throw updateError;
  }

  if (pii.count > 0) {
    await logActivity({
      userId: null,
      projectId,
      action: 'document_pii_detected',
      metadata: { documentId, count: pii.count, types: pii.types },
    });
  }

  return payload.length;
}
