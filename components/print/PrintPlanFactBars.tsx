/**
 * Plan-vs-fact-by-type as a horizontal bar list. Replaces the previous
 * Recharts implementation which rendered awfully when only one type was
 * present (huge bars side-by-side filling the page width).
 *
 * Layout per row: [type-label][plan-bar][fact-bar overlay][values].
 * Pure HTML — no Recharts, no `'use client'`.
 */
interface Row { name: string; plan: number; fact: number; }

const PLAN_COLOR = '#3B82F6';
const FACT_COLOR = '#FF6B2C';
const TROUGH = '#F1F3F6';

function fmtBig(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('ru-RU');
}

export function PrintPlanFactBars({ rows, planLabel, factLabel }: { rows: Row[]; planLabel: string; factLabel: string; }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.flatMap(r => [r.plan, r.fact]), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((r, i) => {
        const planPct = (r.plan / max) * 100;
        const factPct = (r.fact / max) * 100;
        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '120px 1fr 64px 64px 40px',
            alignItems: 'center', gap: 8,
            fontSize: 10,
          }}>
            <span style={{ color: '#333', fontWeight: 500 }}>{r.name}</span>
            <div style={{ position: 'relative', height: 18, background: TROUGH, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 2, bottom: 9, left: 0, width: `${planPct}%`, background: PLAN_COLOR, borderRadius: 3 }} />
              {factPct > 0 && (
                <div style={{ position: 'absolute', top: 9, bottom: 2, left: 0, width: `${factPct}%`, background: FACT_COLOR, borderRadius: 3 }} />
              )}
            </div>
            <span className="pdf-mono" style={{ textAlign: 'right', color: PLAN_COLOR, fontWeight: 600 }}>{fmtBig(r.plan)}</span>
            <span className="pdf-mono" style={{ textAlign: 'right', color: FACT_COLOR, fontWeight: 600 }}>{fmtBig(r.fact)}</span>
            <span className="pdf-mono" style={{ textAlign: 'right', color: '#111', fontWeight: 600 }}>
              {r.plan > 0 ? Math.round((r.fact / r.plan) * 100) + '%' : '—'}
            </span>
          </div>
        );
      })}
      <div className="pdf-mono" style={{
        display: 'grid', gridTemplateColumns: '120px 1fr 64px 64px 40px',
        gap: 8, marginTop: 4, paddingTop: 6, borderTop: '1px solid #f0f1f3',
        fontSize: 9, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        <span></span><span></span>
        <span style={{ textAlign: 'right' }}>{planLabel}</span>
        <span style={{ textAlign: 'right' }}>{factLabel}</span>
        <span style={{ textAlign: 'right' }}>%</span>
      </div>
    </div>
  );
}
