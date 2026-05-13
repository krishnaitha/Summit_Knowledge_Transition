import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatsCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon?: LucideIcon;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          {Icon && (
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                accent ? 'bg-accent-50' : 'bg-brand-50',
              )}
            >
              <Icon className={cn('h-4 w-4', accent ? 'text-accent-600' : 'text-brand-600')} />
            </div>
          )}
        </div>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      </CardContent>
    </Card>
  );
}
