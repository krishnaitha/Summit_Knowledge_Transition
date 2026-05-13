'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface MobileSidebarItem {
  href: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
}

export function MobileSidebar({ items, sectionLabel }: { items: MobileSidebarItem[]; sectionLabel?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="xl:hidden">
      {/* Hamburger trigger — fixed below the navbar */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="fixed left-4 top-[57px] z-40 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-md transition hover:bg-slate-50"
      >
        <Menu className="h-4 w-4 text-slate-600" />
      </button>

      {/* Overlay + drawer */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Navigation</p>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="p-3 space-y-0.5">
              {sectionLabel && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {sectionLabel}
                </p>
              )}
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-brand-700 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                  >
                    {Icon && (
                      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-400')} />
                    )}
                    {item.label}
                    {item.badge != null && item.badge > 0 && (
                      <span className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
