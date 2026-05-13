/**
 * Full-width "top surfaces" list for the PDF. Replaces the cramped vertical
 * Recharts BarChart. One row per screen:
 *   #N · truncated address · proportional bar · formatted OTS
 * Bar widths are scaled to the top-ranked entry so the leader fills the bar.
 */
import { fmtBig } from './PrintKpiStrip';

interface Row {
  address: string;
  ots: number;
}

interface Props {
  rows: Row[];
}

const BAR_COLOR = '#FF6B2C';
const TROUGH_COLOR = '#F1F3F6';
const MAX_ADDRESS_LEN = 60;

function truncate(s: string): string {
  if (s.length <= MAX_ADDRESS_LEN) return s;
  return s.slice(0, MAX_ADDRESS_LEN - 1).trimEnd() + '…';
}

export function PrintTopScreensList({ rows }: Props) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map(r => r.ots), 1);
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
      {rows.map((r, i) => {
        const widthPct = (r.ots / max) * 100;
        return (
          <li
            key={`${r.address}-${i}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 1.2fr 80px',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              className="pdf-mono"
              style={{ fontSize: 10, color: '#888', fontWeight: 600, textAlign: 'right' }}
            >
              #{i + 1}
            </span>
            <span
              style={{
                fontSize: 10,
                color: '#222',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
              title={r.address}
            >
              {truncate(r.address)}
            </span>
            <div
              style={{
                position: 'relative',
                height: 14,
                background: TROUGH_COLOR,
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${widthPct}%`,
                  background: BAR_COLOR,
                  borderRadius: 3,
                }}
              />
            </div>
            <span
              className="pdf-mono"
              style={{ fontSize: 10, fontWeight: 600, color: '#111', textAlign: 'right' }}
            >
              {fmtBig(r.ots)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
