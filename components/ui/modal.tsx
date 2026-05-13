'use client';

import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className={cn('w-full max-w-lg rounded-3xl bg-white p-6 shadow-soft')}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
          <button
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
