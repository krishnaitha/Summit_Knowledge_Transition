'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function getNodeText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child);
      }

      if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
        return getNodeText(child.props.children);
      }

      return '';
    })
    .join('')
    .trim();
}

function getSpecialHeadingClass(label: string): string | null {
  const normalized = label.toLowerCase();

  if (normalized === 'checklist') {
    return 'rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-900';
  }

  if (normalized === 'timeline') {
    return 'rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sky-900';
  }

  if (normalized === 'risk matrix') {
    return 'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-rose-900';
  }

  if (normalized === 'dependency map') {
    return 'rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-amber-900';
  }

  return null;
}

/**
 * Renders a markdown string as rich HTML.
 * `size="sm"` — matches user comment text exactly (text-sm / leading-5).
 * `size="base"` — full Tailwind Typography prose for chat bubbles etc.
 */
export function MarkdownContent({
  content,
  size = 'base',
}: {
  content: string;
  size?: 'sm' | 'base';
}) {
  if (size === 'sm') {
    // Bypass prose entirely — use explicit [&_selector] overrides so the output
    // font-size and line-height exactly match the plain text-sm user comments.
    return (
      <div
        className={[
          'mt-1 text-sm leading-5 text-slate-700',
          '[&_p]:my-1 [&_p]:text-sm [&_p]:leading-5',
          '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_li]:my-0 [&_li]:text-sm [&_li]:leading-5',
          '[&_strong]:font-semibold [&_strong]:text-slate-800',
          '[&_em]:italic',
          '[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_code]:text-slate-800',
          '[&_a]:text-accent-600 [&_a]:underline',
        ].join(' ')}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div
      className={[
        'prose prose-slate max-w-none',
        'prose-headings:font-semibold',
        'prose-a:text-accent-600',
        'prose-table:my-0',
        'prose-th:border prose-th:border-slate-200 prose-th:bg-slate-100 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-th:uppercase prose-th:tracking-wide',
        'prose-td:border prose-td:border-slate-200 prose-td:px-3 prose-td:py-2 prose-td:align-top',
        'prose-li:marker:text-slate-400',
        'prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5',
        'prose-code:text-slate-800 prose-code:before:content-none prose-code:after:content-none',
      ].join(' ')}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => {
            const label = getNodeText(children);
            const specialClass = getSpecialHeadingClass(label);

            return specialClass ? (
              <h2 className={`mt-6 mb-3 text-base font-semibold ${specialClass}`}>{children}</h2>
            ) : (
              <h2 className="mt-6 mb-3 text-lg font-semibold text-slate-900">{children}</h2>
            );
          },
          h3: ({ children }) => {
            const label = getNodeText(children);
            const specialClass = getSpecialHeadingClass(label);

            return specialClass ? (
              <h3 className={`mt-5 mb-3 text-sm font-semibold ${specialClass}`}>{children}</h3>
            ) : (
              <h3 className="mt-5 mb-2 text-base font-semibold text-slate-900">{children}</h3>
            );
          },
          ul: ({ children }) => (
            <ul className="my-3 space-y-2 rounded-2xl bg-slate-50 px-5 py-4">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 space-y-2 rounded-2xl bg-slate-50 px-5 py-4">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-1 text-slate-700">{children}</li>,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-4 rounded-r-2xl border-l-4 border-sky-300 bg-sky-50 px-4 py-3 text-slate-700">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-slate-200" />,
          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-sm text-slate-100">
              {children}
            </pre>
          ),
          code: ({ children }) => (
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-800">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
