export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Hero skeleton */}
      <div className="mb-12">
        <div className="mb-2 h-3 w-20 rounded bg-[var(--surface-3)]" />
        <div className="mb-3 h-10 w-80 rounded bg-[var(--surface-3)]" />
        <div className="h-4 w-64 rounded bg-[var(--surface-3)]" />
      </div>

      {/* KPI cards skeleton */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0,1,2,3].map(i => (
          <div key={i} className="h-32 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-3 h-3 w-20 rounded bg-[var(--surface-3)]" />
            <div className="h-8 w-24 rounded bg-[var(--surface-3)]" />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]" />
        <div className="h-64 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]" />
      </div>

      {/* Map skeleton */}
      <div className="mb-8 h-96 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]" />
    </div>
  );
}
