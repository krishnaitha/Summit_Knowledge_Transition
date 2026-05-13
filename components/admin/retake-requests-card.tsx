'use client';

import { Check, RefreshCw, X } from 'lucide-react';
import { useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

export interface RetakeRequest {
  id: string;
  user_id: string;
  project_id: string;
  reason: string | null;
  status: string;
  created_at: Date | string;
  user_name: string;
  user_email: string;
}

interface RetakeRequestsCardProps {
  projectId: string;
  adminId?: string;
  requests: RetakeRequest[];
  approveAction: (formData: FormData) => Promise<void>;
  rejectAction: (formData: FormData) => Promise<void>;
}

function RequestRow({
  req,
  projectId,
  adminId,
  approveAction,
  rejectAction,
}: {
  req: RetakeRequest;
  projectId: string;
  adminId?: string;
  approveAction: (formData: FormData) => Promise<void>;
  rejectAction: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    const fd = new FormData();
    fd.set('request_id', req.id);
    fd.set('project_id', projectId);
    fd.set('member_id', req.user_id);
    if (adminId) fd.set('admin_id', adminId);
    startTransition(() => approveAction(fd));
  }

  function handleReject() {
    const fd = new FormData();
    fd.set('request_id', req.id);
    fd.set('project_id', projectId);
    if (adminId) fd.set('admin_id', adminId);
    startTransition(() => rejectAction(fd));
  }

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-900">{req.user_name}</p>
          <p className="text-xs text-slate-400">{req.user_email}</p>
          {req.status === 'pending' ? (
            <Badge variant="warning">Pending</Badge>
          ) : req.status === 'approved' ? (
            <Badge variant="success">Approved</Badge>
          ) : (
            <Badge variant="danger">Rejected</Badge>
          )}
        </div>
        <p className="text-xs text-slate-500">Requested {formatDate(req.created_at as string)}</p>
        {req.reason && <p className="text-xs text-slate-600 italic">&quot;{req.reason}&quot;</p>}
      </div>

      {req.status === 'pending' && (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={handleApprove}
            className="flex items-center gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          >
            <Check className="h-3.5 w-3.5" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={handleReject}
            className="flex items-center gap-1.5 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

export function RetakeRequestsCard({
  projectId,
  adminId,
  requests,
  approveAction,
  rejectAction,
}: RetakeRequestsCardProps) {
  const pending = requests.filter((r) => r.status === 'pending');
  const resolved = requests.filter((r) => r.status !== 'pending');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-slate-400" />
          <CardTitle>Quiz re-enable requests</CardTitle>
          {pending.length > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {pending.length} pending
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-6 py-8 text-center">
            <RefreshCw className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No re-enable requests yet.</p>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div className="space-y-2">
                {pending.map((req) => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    projectId={projectId}
                    adminId={adminId}
                    approveAction={approveAction}
                    rejectAction={rejectAction}
                  />
                ))}
              </div>
            )}
            {resolved.length > 0 && (
              <div className="space-y-2">
                {pending.length > 0 && (
                  <p className="pt-2 text-xs font-medium tracking-wider text-slate-400 uppercase">
                    Resolved
                  </p>
                )}
                {resolved.map((req) => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    projectId={projectId}
                    adminId={adminId}
                    approveAction={approveAction}
                    rejectAction={rejectAction}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
