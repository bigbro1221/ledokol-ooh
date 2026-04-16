export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-7 w-40 rounded bg-[var(--surface-3)]" />
        <div className="h-9 w-32 rounded-[var(--radius-md)] bg-[var(--surface-3)]" />
      </div>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="bg-[var(--surface-2)] px-4 py-3">
          <div className="flex gap-16">
            {[80, 100, 60, 50].map((w, i) => (
              <div key={i} className="h-3 rounded bg-[var(--surface-3)]" style={{ width: w }} />
            ))}
          </div>
        </div>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="border-t border-[var(--border)] px-4 py-4">
            <div className="flex gap-16">
              <div className="h-4 w-32 rounded bg-[var(--surface-3)]" />
              <div className="h-4 w-24 rounded bg-[var(--surface-3)]" />
              <div className="h-4 w-16 rounded bg-[var(--surface-3)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
