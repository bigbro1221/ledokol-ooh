'use client';

export function BudgetBar({ total, spent, currency = 'UZS' }: { total: number; spent: number; currency?: string }) {
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold tracking-tight">Бюджет кампании</h3>
      </div>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <span className="text-[28px] font-semibold tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {pct.toFixed(0)}%
          </span>
          <span className="ml-1 text-sm text-[var(--text-3)]">освоено</span>
        </div>
        <div className="text-right text-xs text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
          {formatBudget(spent)} / {formatBudget(total)} {currency}
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : 'var(--brand-primary)',
          }}
        />
      </div>
    </div>
  );
}

function formatBudget(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  return n.toLocaleString('ru-RU');
}
