'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DebouncedDocumentSearchProps {
  initialQuery: string;
  initialProjectId?: string;
  projectOptions?: Array<{ id: string; name: string }>;
  placeholder?: string;
  minChars?: number;
  anchorId?: string;
}

export function DebouncedDocumentSearch({
  initialQuery,
  initialProjectId = '',
  projectOptions = [],
  placeholder = 'Search across all product documents',
  minChars = 2,
  anchorId,
}: DebouncedDocumentSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setSelectedProjectId(initialProjectId);
  }, [initialProjectId]);

  useEffect(() => {
    hasInitializedRef.current = false;
  }, [initialProjectId, initialQuery, pathname]);

  const normalized = useMemo(() => value.trim(), [value]);

  const navigateWithQuery = useCallback(
    (nextQuery: string, nextProjectId: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextQuery) {
        params.set('q', nextQuery);
      } else {
        params.delete('q');
      }

      if (nextProjectId) {
        params.set('projectId', nextProjectId);
      } else {
        params.delete('projectId');
      }

      const hash = anchorId ? `#${anchorId}` : '';
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ''}${hash}`, { scroll: false });
    },
    [anchorId, pathname, router, searchParams],
  );

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (normalized.length >= minChars) {
        navigateWithQuery(normalized, selectedProjectId);
        return;
      }

      if (normalized.length === 0) {
        navigateWithQuery('', selectedProjectId);
      }
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [minChars, navigateWithQuery, normalized, selectedProjectId]);

  const submitSearch: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    if (normalized.length >= minChars) {
      navigateWithQuery(normalized, selectedProjectId);
      return;
    }

    navigateWithQuery('', selectedProjectId);
  };

  return (
    <div className="space-y-2">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitSearch}>
        {projectOptions.length > 0 && (
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 sm:w-64"
            aria-label="Filter by project"
          >
            <option value="">All accessible projects</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        )}
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label="Search all product documents"
        />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {normalized.length > 0 && (
            <Button type="button" variant="ghost" onClick={() => setValue('')}>
              Clear
            </Button>
          )}
        </div>
      </form>
      <p className="text-xs text-slate-500">
        Type at least {minChars} characters. Results refresh automatically as you type.
      </p>
    </div>
  );
}
