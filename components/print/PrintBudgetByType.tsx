/**
 * Budget-by-type list for the PDF. One row per screen type, ordered by budget
 * desc. Layout per row:
 *   [type label] [proportional bar] [formatted budget]
 * Pure HTML/CSS — no Recharts so the rows page-break cleanly.
 */
import { fmtBig } from './PrintKpiStrip';

interface Row {
  name: string;
  budget: number;
  share: number;
}

interface Props {
  rows: Row[];
  totalLabel?: string;
}

const BAR_COLOR = '#3B82F6';
const TROUGH_COLOR = '#F1F3F6';

export function PrintBudgetByType({ rows }: Props) {
  if (rows.length === 0) return null;
  const maxShare = Math.max(...rows.map(r => r.share), 0.0001);
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map(r => {
        // Scale relative to the top entry so the leader fills the bar (rather
        // than each row showing absolute share — which would leave a 10% slice
        // looking visually trivial).
        const widthPct = (r.share / maxShare) * 100;
        return (
          <li
            key={r.name}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 140px',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: '#222' }}>{r.name}</span>
            <div
              style={{
                position: 'relative',
                height: 16,
                background: TROUGH_COLOR,
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${widthPct}%`,
                  background: BAR_COLOR,
                  borderRadius: 4,
                }}
              />
            </div>
            <div
              className="pdf-mono"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                fontSize: 11,
                fontWeight: 600,
                color: '#111',
              }}
            >
              <span>{fmtBig(r.budget)}</span>
              <span style={{ color: '#888', fontWeight: 500, width: 42, textAlign: 'right' }}>
                {Math.round(r.share * 100)}%
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
