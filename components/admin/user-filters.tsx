'use client';

import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProjectRecord } from '@/lib/types/database';

export interface UserFilters {
  role?: 'admin' | 'member';
  status?: 'active' | 'locked';
  projectId?: string;
  lastLoginWindow?: 'today' | '7d' | '30d' | 'never' | 'any';
}

interface UserFiltersProps {
  filters: UserFilters;
  onFiltersChange: (filters: UserFilters) => void;
  projects: ProjectRecord[];
  isOpen: boolean;
  onToggle: () => void;
}

export function UserFiltersPanel({
  filters,
  onFiltersChange,
  projects,
  isOpen,
  onToggle,
}: UserFiltersProps) {
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="relative">
      {/* Toggle Button */}
      <Button
        variant="secondary"
        onClick={onToggle}
        className="flex items-center gap-2"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        Filters
        {activeCount > 0 && (
          <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-xs font-semibold text-white">
            {activeCount}
          </span>
        )}
      </Button>

      {/* Filters Panel */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <div className="space-y-4">
            {/* Role Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Role</label>
              <select
                value={filters.role ?? ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    role: (e.target.value as 'admin' | 'member') || undefined,
                  })
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-200"
              >
                <option value="">— All roles —</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select
                value={filters.status ?? ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    status: (e.target.value as 'active' | 'locked') || undefined,
                  })
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-200"
              >
                <option value="">— All statuses —</option>
                <option value="active">Active</option>
                <option value="locked">Locked</option>
              </select>
            </div>

            {/* Project Filter */}
            {projects.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Project</label>
                <select
                  value={filters.projectId ?? ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      projectId: e.target.value || undefined,
                    })
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-200"
                >
                  <option value="">— All projects —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Last Login Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Last Login</label>
              <select
                value={filters.lastLoginWindow ?? 'any'}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    lastLoginWindow: (e.target.value as any) || 'any',
                  })
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-200"
              >
                <option value="any">— Any time —</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="never">Never</option>
              </select>
            </div>

            {/* Clear Filters */}
            {activeCount > 0 && (
              <button
                onClick={() =>
                  onFiltersChange({
                    role: undefined,
                    status: undefined,
                    projectId: undefined,
                    lastLoginWindow: undefined,
                  })
                }
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
