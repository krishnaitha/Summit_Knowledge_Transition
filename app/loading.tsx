export default function GlobalLoading() {
  return (
    <div className="fixed bottom-2 right-2 z-[9999] w-64 rounded-lg border border-slate-300 bg-white p-3 shadow-xl">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Processing</p>
        <span className="text-xs text-slate-500">Loading...</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-3/4 animate-pulse rounded-full bg-brand-600" />
      </div>
    </div>
  );
}
