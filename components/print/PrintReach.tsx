/**
 * Compact reach widget for the PDF print layout. Mirrors the dashboard
 * reach card (see components/dashboard/reach-card.tsx) using the OVERLAY
 * pattern: a single bar trough per row with the plan width as a neutral
 * grey track and the fact width as a status-colored overlay on top.
 *
 * Light theme, plain HTML/CSS — no CSS variables (Puppeteer doesn't
 * reliably resolve them), no framer-motion, no client-only hooks.
 *
 * One row per pinned tier: [N+ chip] [overlay bar] [plan][fact][%].
 * Hidden entirely when there are no entries.
 */
import { FACT_COLOR, PLAN_TRACK, STATUS_TEXT, TROUGH, statusFor } from './bar-colors';

interface ReachRow {
  n: number;
  plan: number | null;
  fact: number | null;
}

interface Props {
  entries: ReachRow[];
  title: string;           // "Охват" — pass from page.tsx via tDash('reachCardTitle')
  planLabel: string;
  factLabel: string;
  completionLabel?: string;  // optional column header for the % col
}

const CHIP_BG = '#EEF0F4';

function fmtNumber(v: number): string {
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}

export function PrintReach({ entries, title, planLabel, factLabel, completionLabel = '%' }: Props) {
  if (entries.length === 0) return null;
  const tiers = entries.slice().sort((a, b) => a.n - b.n).map(e => ({
    n: e.n, plan: e.plan ?? 0, fact: e.fact ?? 0,
  }));
  const max = Math.max(...tiers.flatMap(t => [t.plan, t.fact]), 1);

  return (
    <div style={{
      border: '1px solid #e6e8eb', borderRadius: 8, padding: '14px 16px', background: '#fff',
    }}>
      <h3 style={{
        margin: 0, marginBottom: 10,
        fontSize: 13, fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: '#444',
      }}>{title}</h3>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tiers.map(t => {
          const status = statusFor(t.plan, t.fact);
          const planPct = (t.plan / max) * 100;
          const factPct = (t.fact / max) * 100;
          const completion = t.plan > 0 ? Math.round((t.fact / t.plan) * 100) : null;
          return (
            <li key={t.n} style={{
              display: 'grid', gridTemplateColumns: '36px 1fr 200px',
              alignItems: 'center', gap: 10,
            }}>
              <span className="pdf-mono" style={{
                background: CHIP_BG, color: '#111', borderRadius: 5,
                padding: '4px 6px', fontSize: 12, fontWeight: 600, textAlign: 'center',
              }}>{t.n}+</span>

              {/* Single bar trough, plan = grey track, fact = colored overlay */}
              <div style={{
                position: 'relative', height: 26, background: TROUGH,
                borderRadius: 5, overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  width: `${planPct}%`, background: PLAN_TRACK, borderRadius: 5,
                }} />
                {factPct > 0 && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    width: `${factPct}%`, background: FACT_COLOR[status], borderRadius: 5,
                  }} />
                )}
              </div>

              <div className="pdf-mono" style={{
                display: 'flex', justifyContent: 'flex-end', gap: 10,
                fontSize: 12, fontWeight: 600,
              }}>
                <span style={{ width: 52, textAlign: 'right', color: '#6B7280' }}>
                  {fmtNumber(t.plan)}
                </span>
                <span style={{ width: 52, textAlign: 'right', color: STATUS_TEXT[status] }}>
                  {fmtNumber(t.fact)}
                </span>
                <span style={{ width: 38, textAlign: 'right', color: STATUS_TEXT[status] }}>
                  {completion !== null ? `${completion}%` : '—'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="pdf-mono" style={{
        marginTop: 10, paddingTop: 8, borderTop: '1px solid #f0f1f3',
        display: 'flex', justifyContent: 'flex-end', gap: 10,
        fontSize: 10, color: '#999',
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        <span style={{ width: 52, textAlign: 'right' }}>{planLabel}</span>
        <span style={{ width: 52, textAlign: 'right' }}>{factLabel}</span>
        <span style={{ width: 38, textAlign: 'right' }}>{completionLabel}</span>
      </div>
    </div>
  );
}
