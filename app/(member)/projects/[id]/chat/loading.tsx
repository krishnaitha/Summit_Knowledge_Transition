export default function MemberProjectChatLoading() {
  return (
    <div className="space-y-6">
      <div className="h-4 w-56 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 space-y-2">
            <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-100" />
          <div className="mt-8 space-y-4">
            <div className="ml-auto h-24 w-2/3 animate-pulse rounded-3xl bg-slate-100" />
            <div className="h-32 w-3/4 animate-pulse rounded-3xl bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
