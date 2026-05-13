/**
 * Compact reach widget for the PDF print layout. Visually mirrors the dashboard
 * reach card (see components/dashboard/reach-card.tsx) but renders with plain
 * static HTML/CSS so Puppeteer can paginate it cleanly — no framer-motion,
 * no client-only hooks, no CSS variables.
 *
 * One row per pinned tier: [N+ chip] [plan/fact bars] [plan][fact][%].
 * Hidden entirely when there are no entries.
 */
interface ReachRow {
  n: number;
  plan: number | null;
  fact: number | null;
}

interface Props {
  entries: ReachRow[];
  planLabel: string;
  factLabel: string;
}

const PLAN_COLOR = '#3B82F6';
const FACT_COLOR = '#FF6B2C';
const TROUGH_COLOR = '#F1F3F6';
const CHIP_BG = '#EEF0F4';

function fmtNumber(v: number): string {
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}

export function PrintReach({ entries, planLabel, factLabel }: Props) {
  if (entries.length === 0) return null;

  // Normalize null → 0 once; scale both bars relative to the global tier max
  // so a 1+/3+/15+ trio reads as a meaningful gradient.
  const tiers = entries
    .slice()
    .sort((a, b) => a.n - b.n)
    .map(e => ({ n: e.n, plan: e.plan ?? 0, fact: e.fact ?? 0 }));
  const max = Math.max(...tiers.flatMap(t => [t.plan, t.fact]), 1);

  return (
    <div
      style={{
        border: '1px solid #e6e8eb',
        borderRadius: 8,
        padding: '12px 14px',
        background: '#fff',
      }}
    >
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tiers.map(t => {
          const planPct = (t.plan / max) * 100;
          const factPct = (t.fact / max) * 100;
          const completion = t.plan > 0 ? Math.round((t.fact / t.plan) * 100) : null;
          return (
            <li
              key={t.n}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr 180px',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                className="pdf-mono"
                style={{
                  background: CHIP_BG,
                  color: '#111',
                  borderRadius: 5,
                  padding: '4px 6px',
                  fontSize: 11,
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                {t.n}+
              </span>

              <div
                style={{
                  position: 'relative',
                  height: 22,
                  background: TROUGH_COLOR,
                  borderRadius: 5,
                  overflow: 'hidden',
                }}
              >
                {/* Plan bar — solid blue, underlay */}
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    bottom: 11,
                    left: 0,
                    width: `${planPct}%`,
                    background: PLAN_COLOR,
                    borderRadius: 3,
                  }}
                />
                {/* Fact bar — solid orange, sits under plan so the two strips
                    are independently legible */}
                {factPct > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 11,
                      bottom: 2,
                      left: 0,
                      width: `${factPct}%`,
                      background: FACT_COLOR,
                      borderRadius: 3,
                    }}
                  />
                )}
              </div>

              <div
                className="pdf-mono"
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <span style={{ width: 52, textAlign: 'right', color: PLAN_COLOR }}>
                  {fmtNumber(t.plan)}
                </span>
                <span style={{ width: 52, textAlign: 'right', color: FACT_COLOR }}>
                  {fmtNumber(t.fact)}
                </span>
                <span style={{ width: 38, textAlign: 'right', color: '#111' }}>
                  {completion !== null ? `${completion}%` : '—'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Column legend mirrors the dashboard widget. */}
      <div
        className="pdf-mono"
        style={{
          marginTop: 8,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          fontSize: 9,
          color: '#999',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ width: 52, textAlign: 'right' }}>{planLabel}</span>
        <span style={{ width: 52, textAlign: 'right' }}>{factLabel}</span>
        <span style={{ width: 38, textAlign: 'right' }}>%</span>
      </div>
    </div>
  );
}
