'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
        'prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5',
        'prose-code:text-slate-800 prose-code:before:content-none prose-code:after:content-none',
      ].join(' ')}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
