export default function WorkspaceLoading() {
  return <div className="page-wrap" role="status" aria-label="Loading page">
    <span className="sr-only">Loading page…</span>
    <div className="h-8 w-56 animate-pulse rounded-md bg-slate-200" />
    <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />)}
    </div>
    <div className="min-h-[360px] animate-pulse rounded-xl border border-slate-200 bg-white" />
  </div>;
}
