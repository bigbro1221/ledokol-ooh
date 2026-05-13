/**
 * Plan-vs-fact-by-type as a horizontal bar list. Uses the OVERLAY pattern
 * that matches the reach widget: a single trough per row, plan = grey
 * track, fact = status-colored overlay (blue on, green over, amber under).
 *
 * Layout per row: [type-label][overlay bar][plan][fact][%].
 * Pure HTML — no Recharts, no `'use client'`.
 */
import { FACT_COLOR, PLAN_TRACK, STATUS_TEXT, TROUGH, statusFor } from './bar-colors';

interface Row { name: string; plan: number; fact: number; }

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r, i) => {
        const status = statusFor(r.plan, r.fact);
        const planPct = (r.plan / max) * 100;
        const factPct = (r.fact / max) * 100;
        const completion = r.plan > 0 ? Math.round((r.fact / r.plan) * 100) : null;
        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '120px 1fr 64px 64px 40px',
            alignItems: 'center', gap: 10,
            fontSize: 11,
          }}>
            <span style={{ color: '#333', fontWeight: 500 }}>{r.name}</span>
            <div style={{ position: 'relative', height: 20, background: TROUGH, borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${planPct}%`, background: PLAN_TRACK, borderRadius: 5 }} />
              {factPct > 0 && (
                <div style={{ position: 'absolute', inset: 0, width: `${factPct}%`, background: FACT_COLOR[status], borderRadius: 5 }} />
              )}
            </div>
            <span className="pdf-mono" style={{ textAlign: 'right', color: '#6B7280', fontWeight: 600 }}>{fmtBig(r.plan)}</span>
            <span className="pdf-mono" style={{ textAlign: 'right', color: STATUS_TEXT[status], fontWeight: 600 }}>{fmtBig(r.fact)}</span>
            <span className="pdf-mono" style={{ textAlign: 'right', color: STATUS_TEXT[status], fontWeight: 600 }}>
              {completion !== null ? completion + '%' : '—'}
            </span>
          </div>
        );
      })}
      <div className="pdf-mono" style={{
        display: 'grid', gridTemplateColumns: '120px 1fr 64px 64px 40px',
        gap: 10, marginTop: 4, paddingTop: 8, borderTop: '1px solid #f0f1f3',
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
