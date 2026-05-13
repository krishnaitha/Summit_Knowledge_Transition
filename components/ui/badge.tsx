import { cn } from '@/lib/utils';

const variants = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
  info: 'bg-brand-100 text-brand-700',
};

export function Badge({
  children,
  className,
  variant = 'neutral',
}: {
  children: React.ReactNode;
  className?: string;
  variant?: keyof typeof variants;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
