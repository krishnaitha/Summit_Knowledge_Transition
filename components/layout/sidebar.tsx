'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface SidebarItem {
  href: string;
  label: string;
  icon?: LucideIcon;
}

export function Sidebar({ items, sectionLabel }: { items: SidebarItem[]; sectionLabel?: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 xl:block">
      <div className="glass-panel rounded-2xl p-3">
        {sectionLabel && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {sectionLabel}
          </p>
        )}
        <nav className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
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
                  <Icon
                    className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-400')}
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
