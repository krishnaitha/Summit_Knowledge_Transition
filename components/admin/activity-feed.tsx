import { LogIn, MessageSquare, FileText, PlayCircle, CheckCircle2, Activity } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; dot: string }> = {
  login: { label: 'Signed in', icon: LogIn, dot: 'bg-brand-400' },
  chatbot_message: { label: 'Asked the AI', icon: MessageSquare, dot: 'bg-accent-500' },
  document_viewed: { label: 'Viewed a document', icon: FileText, dot: 'bg-slate-400' },
  quiz_started: { label: 'Started quiz', icon: PlayCircle, dot: 'bg-amber-400' },
  quiz_submitted: { label: 'Submitted quiz', icon: CheckCircle2, dot: 'bg-emerald-500' },
};

export function ActivityFeed({
  items,
}: {
  items: Array<{ id: string; action: string; created_at: string; userName?: string | null }>;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-400" />
          <CardTitle>Recent activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <div className="space-y-1">
            {items.map((item) => {
              const config = ACTION_CONFIG[item.action] ?? {
                label: item.action,
                icon: Activity,
                dot: 'bg-slate-300',
              };
              const Icon = config.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                >
                  <div className={`h-2 w-2 shrink-0 rounded-full ${config.dot}`} />
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <div className="flex flex-1 items-baseline gap-2 overflow-hidden">
                    <p className="shrink-0 text-sm font-medium text-slate-800">{config.label}</p>
                    {item.userName && (
                      <p className="truncate text-sm text-slate-500">· {item.userName}</p>
                    )}
                  </div>
                  <p className="shrink-0 text-xs text-slate-400">
                    {formatDate(item.created_at, true)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-slate-400">No activity recorded yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
