'use client';

import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  bulkAssignToProjectAction,
  bulkToggleUserActiveAction,
  bulkUpdateUserRoleAction,
  toggleUserActiveAction,
  updateUserRoleAction,
} from '@/app/actions/admin';
import { UserDetailDrawer } from '@/components/admin/user-detail-drawer';
import { UserFiltersPanel, type UserFilters } from '@/components/admin/user-filters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { downloadCsv, generateUsersCsv } from '@/lib/export';
import type { ActivityRecord, ProjectRecord, UserProfile } from '@/lib/types/database';
import { formatDate } from '@/lib/utils';

const PAGE_SIZE = 10;

interface EnhancedUsersTableProps {
  users: UserProfile[];
  projects: ProjectRecord[];
  activity: ActivityRecord[];
}

export function UsersTable({ users, projects, activity }: EnhancedUsersTableProps) {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userProjectCounts, setUserProjectCounts] = useState<Map<string, number>>(new Map());
  const [userQuizStats, setUserQuizStats] = useState<
    Map<string, { completed: number; inProgress: number; notStarted: number }>
  >(new Map());
  const [userActivityCache, setUserActivityCache] = useState<Map<string, ActivityRecord[]>>(
    new Map(),
  );
  const [appliedFilters, setAppliedFilters] = useState<UserFilters>({
    lastLoginWindow: 'any',
  });
  const [bulkActionType, setBulkActionType] = useState<string>('');
  const [bulkProjectId, setBulkProjectId] = useState<string>('');

  // Fetch user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      const projectCounts = new Map<string, number>();
      const quizStats = new Map<
        string,
        { completed: number; inProgress: number; notStarted: number }
      >();
      const activityCache = new Map<string, ActivityRecord[]>();

      // This would normally be fetched from the server
      // For now, we'll just cache the activity that was passed in
      for (const user of users) {
        const userActivities = activity.filter((a) => a.user_id === user.id);
        activityCache.set(user.id, userActivities);
        projectCounts.set(user.id, 0);
        quizStats.set(user.id, { completed: 0, inProgress: 0, notStarted: 0 });
      }

      setUserActivityCache(activityCache);
      setUserProjectCounts(projectCounts);
      setUserQuizStats(quizStats);
    };

    fetchUserData();
  }, [users, activity]);

  // Filter users based on search and filter criteria
  const filtered = users.filter((u) => {
    // Text search
    const q = filter.toLowerCase();
    const matchesSearch =
      u.email.toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q);

    if (!matchesSearch) return false;

    // Role filter
    if (appliedFilters.role && u.role !== appliedFilters.role) return false;

    // Status filter
    if (appliedFilters.status === 'active' && u.is_active === false) return false;
    if (appliedFilters.status === 'locked' && u.is_active !== false) return false;

    // Last login filter
    if (appliedFilters.lastLoginWindow && appliedFilters.lastLoginWindow !== 'any') {
      const now = new Date();
      const lastLogin = u.last_login_at ? new Date(u.last_login_at) : null;

      if (appliedFilters.lastLoginWindow === 'never') {
        if (lastLogin !== null) return false;
      } else if (lastLogin === null) {
        return false;
      } else {
        const daysAgo =
          appliedFilters.lastLoginWindow === 'today'
            ? 1
            : appliedFilters.lastLoginWindow === '7d'
              ? 7
              : 30;
        const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        if (lastLogin < cutoffDate) return false;
      }
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const start = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE + PAGE_SIZE, filtered.length);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filtered.map((u) => u.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkAction = async () => {
    if (selectedIds.size === 0) return;

    const userIds = Array.from(selectedIds);

    if (bulkActionType === 'lock') {
      const formData = new FormData();
      formData.set('user_ids', userIds.join(','));
      formData.set('next_state', 'false');
      await bulkToggleUserActiveAction(formData);
      setSelectedIds(new Set());
    } else if (bulkActionType === 'unlock') {
      const formData = new FormData();
      formData.set('user_ids', userIds.join(','));
      formData.set('next_state', 'true');
      await bulkToggleUserActiveAction(formData);
      setSelectedIds(new Set());
    } else if (bulkActionType === 'make-admin') {
      const formData = new FormData();
      formData.set('user_ids', userIds.join(','));
      formData.set('role', 'admin');
      await bulkUpdateUserRoleAction(formData);
      setSelectedIds(new Set());
    } else if (bulkActionType === 'make-member') {
      const formData = new FormData();
      formData.set('user_ids', userIds.join(','));
      formData.set('role', 'member');
      await bulkUpdateUserRoleAction(formData);
      setSelectedIds(new Set());
    } else if (bulkActionType === 'assign-project' && bulkProjectId) {
      const formData = new FormData();
      formData.set('user_ids', userIds.join(','));
      formData.set('project_id', bulkProjectId);
      await bulkAssignToProjectAction(formData);
      setSelectedIds(new Set());
      setBulkProjectId('');
    }

    setBulkActionType('');
  };

  const handleExport = () => {
    const csvContent = generateUsersCsv(
      filtered.map((u) => ({
        ...u,
        projectCount: userProjectCounts.get(u.id) ?? 0,
      })),
    );
    downloadCsv(csvContent, `users-export-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-4">
      {/* Header with search and controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Filter by name or email…"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <UserFiltersPanel
            filters={appliedFilters}
            onFiltersChange={(newFilters) => {
              setAppliedFilters(newFilters);
              setPage(0);
            }}
            projects={projects}
            isOpen={filtersOpen}
            onToggle={() => setFiltersOpen(!filtersOpen)}
          />
          <Button variant="secondary" onClick={handleExport} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className="bg-accent-50 rounded-lg border border-slate-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-900">
              {selectedIds.size} user{selectedIds.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                value={bulkActionType}
                onChange={(e) => setBulkActionType(e.target.value)}
                className="focus:border-accent-500 focus:ring-accent-200 h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2"
              >
                <option value="">— Select action —</option>
                <option value="lock">Lock users</option>
                <option value="unlock">Unlock users</option>
                <option value="make-admin">Make admin</option>
                <option value="make-member">Make member</option>
                <option value="assign-project">Assign to project</option>
              </select>

              {bulkActionType === 'assign-project' && (
                <select
                  value={bulkProjectId}
                  onChange={(e) => setBulkProjectId(e.target.value)}
                  className="focus:border-accent-500 focus:ring-accent-200 h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2"
                >
                  <option value="">— Select project —</option>
                  {projects
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              )}

              <Button
                onClick={handleBulkAction}
                disabled={
                  !bulkActionType || (bulkActionType === 'assign-project' && !bulkProjectId)
                }
                className="flex items-center gap-2"
              >
                Apply
              </Button>

              <Button
                variant="secondary"
                onClick={() => setSelectedIds(new Set())}
                className="flex items-center gap-2"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Users List */}
      {visible.length ? (
        <div className="space-y-3">
          {/* Select All Checkbox */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="text-accent-600 focus:ring-accent-500 h-4 w-4 rounded border-slate-300 focus:ring-2"
              />
              <label className="text-sm font-medium text-slate-600">
                Select all {filtered.length} users on this page
              </label>
            </div>
          )}

          {visible.map((user) => (
            <div
              key={user.id}
              className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 xl:flex-row xl:items-center xl:justify-between"
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(user.id)}
                  onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                  className="text-accent-600 focus:ring-accent-500 mt-1 h-4 w-4 rounded border-slate-300 focus:ring-2"
                />
                <div
                  onClick={() => setSelectedUser(user)}
                  className="flex-1 cursor-pointer transition-opacity hover:opacity-75"
                >
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-slate-900">{user.full_name ?? user.email}</p>
                    <Badge variant={user.role === 'admin' ? 'info' : 'neutral'}>{user.role}</Badge>
                    <Badge variant={user.is_active === false ? 'warning' : 'success'}>
                      {user.is_active === false ? 'Locked' : 'Active'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Created {formatDate(user.created_at, true)} &bull; Last login{' '}
                    {formatDate(user.last_login_at, true)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <form action={updateUserRoleAction}>
                  <input name="user_id" type="hidden" value={user.id} />
                  <input
                    name="role"
                    type="hidden"
                    value={user.role === 'admin' ? 'member' : 'admin'}
                  />
                  <SubmitButton variant="secondary" loadingText="Updating…">
                    {user.role === 'admin' ? 'Demote to member' : 'Promote to admin'}
                  </SubmitButton>
                </form>
                <form action={toggleUserActiveAction}>
                  <input name="user_id" type="hidden" value={user.id} />
                  <input name="next_state" type="hidden" value={String(user.is_active === false)} />
                  <SubmitButton
                    variant={user.is_active === false ? 'primary' : 'danger'}
                    loadingText="Updating…"
                  >
                    {user.is_active === false ? 'Unlock user' : 'Lock user'}
                  </SubmitButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          {filter ? 'No users match your filter.' : 'No users found.'}
        </p>
      )}

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-500">
            {start}–{end} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* User Detail Drawer */}
      <UserDetailDrawer
        user={selectedUser}
        isOpen={selectedUser !== null}
        onClose={() => setSelectedUser(null)}
        activity={userActivityCache.get(selectedUser?.id ?? '') ?? []}
        projectCount={userProjectCounts.get(selectedUser?.id ?? '') ?? 0}
        quizStats={userQuizStats.get(selectedUser?.id ?? '')}
      />
    </div>
  );
}
