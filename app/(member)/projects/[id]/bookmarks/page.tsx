import Link from 'next/link';
import { Bookmark, ChevronRight } from 'lucide-react';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireMember } from '@/lib/auth';
import { getProjectBookmarks, getProjectById, userHasProjectAccess } from '@/lib/data';
import { formatDate } from '@/lib/utils';

export default async function ProjectBookmarksPage({ params }: { params: { id: string } }) {
  const { profile } = await requireMember();
  const canAccess = await userHasProjectAccess(profile!.id, profile?.role, params.id);

  if (!canAccess) {
    redirect('/dashboard');
  }

  const [project, bookmarks] = await Promise.all([
    getProjectById(params.id),
    getProjectBookmarks(profile!.id, params.id),
  ]);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/dashboard" className="transition hover:text-slate-900">Dashboard</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/projects/${params.id}`} className="transition hover:text-slate-900">{project?.name ?? 'Project'}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Bookmarks</span>
      </nav>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-amber-500" />
            <CardTitle>Bookmarked answers</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {bookmarks.length ? (
            bookmarks.map((bookmark) => (
              <div key={bookmark.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-900">{bookmark.message.content}</p>
                {Array.isArray(bookmark.message.sources) && bookmark.message.sources.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bookmark.message.sources.map((source, i) => (
                      <Badge key={i} variant="info">{source.documentName}</Badge>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-slate-400">Bookmarked {formatDate(bookmark.created_at, true)}</p>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <Bookmark className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-4 text-sm text-slate-500">No bookmarks yet. Click the bookmark icon on any AI answer in chat to save it here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
