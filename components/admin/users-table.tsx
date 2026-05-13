'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

import { toggleUserActiveAction, updateUserRoleAction } from '@/app/actions/admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import type { UserProfile } from '@/lib/types/database';
import { formatDate } from '@/lib/utils';

const PAGE_SIZE = 10;

export function UsersTable({ users }: { users: UserProfile[] }) {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  const filtered = users.filter((u) => {
    const q = filter.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const start = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE + PAGE_SIZE, filtered.length);

  return (
    <div className="space-y-4">
      {users.length > PAGE_SIZE && (
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
      )}

      {visible.length ? (
        visible.map((user) => (
          <div
            key={user.id}
            className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 xl:flex-row xl:items-center xl:justify-between"
          >
            <div>
              <div className="flex items-center gap-3">
                <p className="font-semibold text-slate-900">{user.full_name ?? user.email}</p>
                <Badge variant={user.role === 'admin' ? 'info' : 'neutral'}>{user.role}</Badge>
                <Badge variant={user.is_active === false ? 'warning' : 'success'}>
                  {user.is_active === false ? 'Inactive' : 'Active'}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">{user.email}</p>
              <p className="mt-1 text-xs text-slate-400">
                Created {formatDate(user.created_at, true)} &bull; Last login{' '}
                {formatDate(user.last_login_at, true)}
              </p>
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
                  {user.is_active === false ? 'Reactivate' : 'Deactivate'}
                </SubmitButton>
              </form>
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-slate-500">
          {filter ? 'No users match your filter.' : 'No users found.'}
        </p>
      )}

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
    </div>
  );
}
