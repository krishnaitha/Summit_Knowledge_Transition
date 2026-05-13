'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, FileText, Loader2, Upload, X, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type FileStatus = 'pending' | 'uploading' | 'processing' | 'done' | 'error';

interface QueueItem {
  id: string;
  file: File;
  status: FileStatus;
  step: string | null;
  error: string | null;
  jobId: string | null;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPTED = /\.(pdf|docx|xlsx|txt|csv)$/i;
const POLL_INTERVAL_MS = 3000;

export function DocumentUploadPanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // Map from item id → polling interval handle
  const pollRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Clear all polling intervals on unmount
  useEffect(() => {
    const refs = pollRefs.current;
    return () => {
      for (const timer of refs.values()) clearInterval(timer);
    };
  }, []);

  const stopPolling = (itemId: string) => {
    const timer = pollRefs.current.get(itemId);
    if (timer !== undefined) {
      clearInterval(timer);
      pollRefs.current.delete(itemId);
    }
  };

  const addFiles = (incoming: FileList | File[]) => {
    const valid = Array.from(incoming).filter((f) => ACCEPTED.test(f.name));
    if (!valid.length) return;
    setQueue((prev) => [
      ...prev,
      ...valid.map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
        file: f,
        status: 'pending' as FileStatus,
        step: null,
        error: null,
        jobId: null,
      })),
    ]);
  };

  const removeItem = (id: string) => {
    stopPolling(id);
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, patch: Partial<QueueItem>) =>
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const startPolling = (itemId: string, jobId: string) => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const job = await res.json();

        if (job.status === 'running') {
          updateItem(itemId, { step: 'Embedding chunks…' });
        } else if (job.status === 'done') {
          stopPolling(itemId);
          updateItem(itemId, { status: 'done', step: null });
          router.refresh();
        } else if (job.status === 'failed') {
          stopPolling(itemId);
          updateItem(itemId, {
            status: 'error',
            step: null,
            error: job.error ?? 'Processing failed',
          });
        }
      } catch {
        // network hiccup — keep polling
      }
    }, POLL_INTERVAL_MS);

    pollRefs.current.set(itemId, timer);
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const handleUpload = async () => {
    const pending = queue.filter((i) => i.status === 'pending');
    if (!pending.length) return;

    setIsUploading(true);
    try {
      for (const item of pending) {
        updateItem(item.id, { status: 'uploading', step: 'Uploading…', error: null });

        const formData = new FormData();
        formData.append('projectId', projectId);
        formData.append('file', item.file);

        const uploadRes = await fetch('/api/documents/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          updateItem(item.id, {
            status: 'error',
            step: null,
            error: uploadData.error ?? 'Upload failed',
          });
          continue;
        }

        updateItem(item.id, { status: 'processing', step: 'Queued — processing in background…' });

        const processRes = await fetch('/api/documents/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: uploadData.documentId, projectId }),
        });
        const processData = await processRes.json();

        if (!processRes.ok) {
          updateItem(item.id, {
            status: 'error',
            step: null,
            error: processData.error ?? 'Processing failed',
          });
          continue;
        }

        // Store jobId and start polling for completion
        updateItem(item.id, { jobId: processData.jobId, step: 'Processing…' });
        startPolling(item.id, processData.jobId);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const pendingCount = queue.filter((i) => i.status === 'pending').length;
  const allDone =
    queue.length > 0 && queue.every((i) => i.status === 'done' || i.status === 'error');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-brand-600" />
          <CardTitle>Upload to knowledge base</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition',
            dragging
              ? 'border-accent-400 bg-accent-50'
              : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50',
          )}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50">
            <Upload className="h-5 w-5 text-brand-500" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-700">
            Drop files here or click to browse
          </p>
          <p className="mt-1 text-xs text-slate-400">
            PDF · DOCX · XLSX · TXT · CSV · Multiple files supported
          </p>
          <input
            ref={inputRef}
            accept=".pdf,.docx,.xlsx,.txt,.csv"
            className="hidden"
            type="file"
            multiple
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {/* File queue */}
        {queue.length > 0 && (
          <div className="space-y-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border px-4 py-3 transition',
                  item.status === 'done' && 'border-emerald-200 bg-emerald-50',
                  item.status === 'error' && 'border-rose-200 bg-rose-50',
                  item.status === 'uploading' || item.status === 'processing'
                    ? 'border-accent-200 bg-accent-50'
                    : item.status === 'pending'
                      ? 'border-slate-200 bg-slate-50'
                      : '',
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    item.status === 'done'
                      ? 'bg-emerald-100'
                      : item.status === 'error'
                        ? 'bg-rose-100'
                        : 'bg-brand-100',
                  )}
                >
                  {item.status === 'done' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  {item.status === 'error' && <AlertCircle className="h-4 w-4 text-rose-600" />}
                  {(item.status === 'uploading' || item.status === 'processing') && (
                    <Loader2 className="h-4 w-4 animate-spin text-accent-600" />
                  )}
                  {item.status === 'pending' && <FileText className="h-4 w-4 text-brand-600" />}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{item.file.name}</p>
                  <p className="text-xs text-slate-500">
                    {item.error
                      ? item.error
                      : item.step
                        ? item.step
                        : item.status === 'done'
                          ? 'Ready in knowledge base'
                          : formatBytes(item.file.size)}
                  </p>
                </div>

                {/* Remove (only when not active) */}
                {item.status === 'pending' && !isUploading && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <Button disabled={isUploading} onClick={handleUpload} type="button">
              {isUploading
                ? 'Uploading…'
                : `Upload ${pendingCount} file${pendingCount > 1 ? 's' : ''}`}
            </Button>
          )}
          {allDone && (
            <Button variant="secondary" onClick={() => setQueue([])} type="button">
              Clear list
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
