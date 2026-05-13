'use client';

import { BarChart3, Calendar, Mail, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { ActivityRecord, UserProfile } from '@/lib/types/database';
import { formatDate } from '@/lib/utils';

interface UserDetailDrawerProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  activity: ActivityRecord[];
  projectCount: number;
  quizStats?: {
    completed: number;
    inProgress: number;
    notStarted: number;
  };
}

export function UserDetailDrawer({
  user,
  isOpen,
  onClose,
  activity,
  projectCount,
  quizStats,
}: UserDetailDrawerProps) {
  if (!isOpen || !user) return null;

  const recentActivity = activity.filter((a) => a.user_id === user.id).slice(0, 8);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={onClose}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 z-50 h-screen w-full max-w-md overflow-y-auto bg-white shadow-xl transition-transform">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">User Details</h2>
          <button
            onClick={onClose}
            className="text-slate-400 transition-colors hover:text-slate-600"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 p-6">
          {/* User Header Section */}
          <div className="space-y-3">
            <div>
              <p className="text-lg font-semibold text-slate-900">{user.full_name ?? user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={user.role === 'admin' ? 'info' : 'neutral'}>{user.role}</Badge>
                <Badge variant={user.is_active === false ? 'warning' : 'success'}>
                  {user.is_active === false ? 'Locked' : 'Active'}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail className="h-4 w-4" />
              <span className="font-mono text-xs text-slate-500">{user.email}</span>
            </div>
          </div>

          {/* Timeline Info */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                <Calendar className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Created
                </p>
                <p className="text-sm font-medium text-slate-900">{formatDate(user.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                <Calendar className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Last Login
                </p>
                <p className="text-sm font-medium text-slate-900">
                  {user.last_login_at ? formatDate(user.last_login_at) : 'Never'}
                </p>
              </div>
            </div>
          </div>

          {/* Activity Stats */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <BarChart3 className="h-4 w-4" />
              Activity Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs tracking-wide text-slate-500 uppercase">Projects</p>
                <p className="text-xl font-semibold text-slate-900">{projectCount}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs tracking-wide text-slate-500 uppercase">Activities</p>
                <p className="text-xl font-semibold text-slate-900">{activity.length}</p>
              </div>
              {quizStats && (
                <>
                  <div className="rounded-lg bg-green-50 p-3">
                    <p className="text-xs tracking-wide text-green-600 uppercase">Completed</p>
                    <p className="text-xl font-semibold text-green-900">{quizStats.completed}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3">
                    <p className="text-xs tracking-wide text-amber-600 uppercase">In Progress</p>
                    <p className="text-xl font-semibold text-amber-900">{quizStats.inProgress}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
              <div className="space-y-2">
                {recentActivity.map((act) => (
                  <div key={act.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <p className="font-medium text-slate-900 capitalize">
                      {act.action.replace(/_/g, ' ')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(act.created_at, true)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Activity */}
          {recentActivity.length === 0 && (
            <div className="rounded-lg bg-slate-50 p-4 text-center">
              <p className="text-sm text-slate-500">No activity recorded</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
