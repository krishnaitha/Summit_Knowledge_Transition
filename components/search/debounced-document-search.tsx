'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DebouncedDocumentSearchProps {
  initialQuery: string;
  placeholder?: string;
  minChars?: number;
  anchorId?: string;
}

export function DebouncedDocumentSearch({
  initialQuery,
  placeholder = 'Search across all product documents',
  minChars = 2,
  anchorId,
}: DebouncedDocumentSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  const normalized = useMemo(() => value.trim(), [value]);

  const navigateWithQuery = useCallback(
    (nextQuery: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextQuery) {
        params.set('q', nextQuery);
      } else {
        params.delete('q');
      }

      const hash = anchorId ? `#${anchorId}` : '';
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ''}${hash}`, { scroll: false });
    },
    [anchorId, pathname, router, searchParams],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (normalized.length >= minChars) {
        navigateWithQuery(normalized);
        return;
      }

      if (normalized.length === 0) {
        navigateWithQuery('');
      }
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [minChars, navigateWithQuery, normalized]);

  const submitSearch: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    if (normalized.length >= minChars) {
      navigateWithQuery(normalized);
      return;
    }

    navigateWithQuery('');
  };

  return (
    <div className="space-y-2">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitSearch}>
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
