'use client';

import { AlertCircle, CheckCircle, Database, Download, FileText, Lightbulb } from 'lucide-react';
import { useState } from 'react';

import {
  generateDocumentFromTranscriptAction,
  pushToKnowledgeBaseAction,
} from '@/app/actions/transcript';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

type Project = { id: string; name: string };

interface GenerateDocumentFormProps {
  projects: Project[];
  suggestedContext?: string;
  suggestedTranscript?: string;
  suggestedTitle?: string;
  preselectedProjectId?: string;
}

export function GenerateDocumentForm({
  projects,
  suggestedContext,
  suggestedTranscript,
  suggestedTitle,
  preselectedProjectId,
}: GenerateDocumentFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{
    content: string;
    contentBase64?: string;
    filename: string;
    title: string;
    format: string;
  } | null>(null);

  // Push-to-KB state
  const [pushProjectId, setPushProjectId] = useState(preselectedProjectId ?? '');
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'pushed' | 'error'>('idle');
  const [pushError, setPushError] = useState<string | null>(null);

  async function handleSubmit(e: { preventDefault(): void; currentTarget: HTMLFormElement }) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setPushStatus('idle');
    setPushError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await generateDocumentFromTranscriptAction(formData);

      if (result.success) {
        setGenerated({
          content: result.content,
          contentBase64: result.contentBase64,
          filename: result.filename,
          title: result.title,
          format: result.format,
        });
      } else {
        setError('Failed to generate document');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  function downloadDocument() {
    if (!generated) return;

    let blob: Blob;
    if (generated.format === 'docx' && generated.contentBase64) {
      const bytes = Uint8Array.from(atob(generated.contentBase64), (c) => c.charCodeAt(0));
      blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    } else {
      blob = new Blob([generated.content], { type: 'text/plain;charset=utf-8' });
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generated.filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  async function handlePushToKnowledgeBase() {
    if (!generated || !pushProjectId) return;

    setPushStatus('pushing');
    setPushError(null);

    try {
      // For docx, always push the markdown content with .md extension
      const kbFilename =
        generated.format === 'docx'
          ? generated.filename.replace('.docx', '.md')
          : generated.filename;

      await pushToKnowledgeBaseAction({
        content: generated.content,
        filename: kbFilename,
        projectId: pushProjectId,
      });
      setPushStatus('pushed');
    } catch (err) {
      setPushStatus('error');
      setPushError(err instanceof Error ? err.message : 'Failed to push to knowledge base');
    }
  }

  if (generated) {
    const selectedProject = projects.find((p) => p.id === pushProjectId);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>Generated Document</span>
            <button
              onClick={() => {
                setGenerated(null);
                setPushStatus('idle');
                setPushError(null);
                setPushProjectId('');
              }}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              ← Back
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-900">{generated.title}</h3>
            <p className="mt-1 text-xs text-slate-500">{generated.filename}</p>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
            <pre className="text-xs whitespace-pre-wrap text-slate-700">{generated.content}</pre>
          </div>

          <button
            onClick={downloadDocument}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Download Document
          </button>

          {/* Push to Knowledge Base */}
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Push to Knowledge Base
            </p>

            {pushStatus === 'pushed' ? (
              <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    Added to {selectedProject?.name ?? 'project'}
                  </p>
                  <p className="mt-0.5 text-xs text-green-700">
                    The document is being processed in the background — it will be chunked,
                    embedded, and available for RAG chat shortly.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {pushError && (
                  <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <p className="text-sm text-red-700">{pushError}</p>
                  </div>
                )}

                <select
                  value={pushProjectId}
                  onChange={(e) => setPushProjectId(e.target.value)}
                  disabled={pushStatus === 'pushing'}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-slate-900 focus:outline-none disabled:bg-slate-100"
                >
                  <option value="">Select a project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handlePushToKnowledgeBase}
                  disabled={!pushProjectId || pushStatus === 'pushing'}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  <Database className="h-4 w-4" />
                  {pushStatus === 'pushing' ? 'Adding to knowledge base…' : 'Add to Knowledge Base'}
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Paste Transcript
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {suggestedTranscript ? (
            <div className="flex gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              <div>
                <p className="text-xs font-semibold text-green-800">
                  Thread conversation pre-loaded
                </p>
                <p className="mt-0.5 text-xs text-green-700">
                  The Q&amp;A from this knowledge-gap thread has been filled in below. Review and
                  generate your document.
                </p>
              </div>
            </div>
          ) : suggestedContext ? (
            <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div>
                <p className="text-xs font-semibold text-blue-800">Suggested capture</p>
                <p className="mt-0.5 text-xs text-blue-700">
                  Members asked this and got no answer: &ldquo;{suggestedContext}&rdquo;
                </p>
              </div>
            </div>
          ) : null}

          {error && (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Transcript Content
            </label>
            <Textarea
              name="transcript"
              placeholder="Paste meeting transcript, interview notes, or conversation here..."
              className="mt-2 min-h-80"
              required
              disabled={isLoading}
              defaultValue={suggestedTranscript}
            />
          </div>

          <div>
            <label className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Document Title (optional)
            </label>
            <input
              type="text"
              name="title"
              defaultValue={
                suggestedTitle ??
                (suggestedContext ? `Knowledge: ${suggestedContext.slice(0, 60)}` : undefined)
              }
              placeholder="e.g., Onboarding Process Documentation"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 transition focus:border-slate-900 focus:outline-none disabled:bg-slate-100"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Export Format
            </label>
            <div className="mt-2 flex gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="format"
                  value="markdown"
                  defaultChecked
                  className="h-4 w-4"
                  disabled={isLoading}
                />
                <span className="text-sm text-slate-700">Markdown (.md)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="format"
                  value="text"
                  className="h-4 w-4"
                  disabled={isLoading}
                />
                <span className="text-sm text-slate-700">Plain Text (.txt)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="format"
                  value="docx"
                  className="h-4 w-4"
                  disabled={isLoading}
                />
                <span className="text-sm text-slate-700">Word Document (.docx)</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {isLoading ? 'Generating…' : 'Generate Document'}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
