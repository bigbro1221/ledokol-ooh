/**
 * Per-city plan-vs-fact OTS table for the PDF. Layout:
 *   | Город | (overlay bar: plan track + fact overlay) | План | Факт | % |
 *
 * The bar cell uses the OVERLAY pattern shared with the reach widget:
 * a single trough, plan = grey track, fact = status-colored overlay
 * (blue on, green over, amber under). Values to the right adopt the
 * same color logic (plan muted, fact + completion status-colored).
 * Pure HTML — no Recharts.
 */
import { fmtBig } from './PrintKpiStrip';
import { FACT_COLOR, PLAN_TRACK, STATUS_TEXT, TROUGH, statusFor } from './bar-colors';

interface Row {
  city: string;
  plan: number;
  fact: number;
}

interface Props {
  rows: Row[];
  cityLabel: string;
  planLabel: string;
  factLabel: string;
}

export function PrintCityPlanFactTable({ rows, cityLabel, planLabel, factLabel }: Props) {
  if (rows.length === 0) return null;
  // Scale to max of plan AND fact so over-delivery (fact > plan) still fits
  // proportionally inside the trough rather than getting clipped.
  const max = Math.max(...rows.flatMap(r => [r.plan, r.fact]), 1);

  return (
    <table className="pdf-city-plan-fact" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
      <thead>
        <tr>
          <th style={headerCell('left', 110)}>{cityLabel}</th>
          <th style={headerCell('left')} />
          <th style={headerCell('right', 80)}>{planLabel}</th>
          <th style={headerCell('right', 80)}>{factLabel}</th>
          <th style={headerCell('right', 50)}>%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const status = statusFor(r.plan, r.fact);
          const planPct = (r.plan / max) * 100;
          const factPct = (r.fact / max) * 100;
          const completion = r.plan > 0 ? Math.round((r.fact / r.plan) * 100) : null;
          return (
            <tr key={r.city}>
              <td style={bodyCell('left')}>{r.city}</td>
              <td style={{ ...bodyCell('left'), paddingTop: 6, paddingBottom: 6 }}>
                <div
                  style={{
                    position: 'relative',
                    height: 22,
                    background: TROUGH,
                    borderRadius: 5,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ position: 'absolute', inset: 0, width: `${planPct}%`, background: PLAN_TRACK, borderRadius: 5 }} />
                  {factPct > 0 && (
                    <div style={{ position: 'absolute', inset: 0, width: `${factPct}%`, background: FACT_COLOR[status], borderRadius: 5 }} />
                  )}
                </div>
              </td>
              <td style={{ ...bodyCell('right'), color: '#6B7280', fontWeight: 600 }} className="pdf-mono">
                {fmtBig(r.plan)}
              </td>
              <td style={{ ...bodyCell('right'), color: STATUS_TEXT[status], fontWeight: 600 }} className="pdf-mono">
                {fmtBig(r.fact)}
              </td>
              <td style={{ ...bodyCell('right'), color: STATUS_TEXT[status], fontWeight: 600 }} className="pdf-mono">
                {completion !== null ? `${completion}%` : '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function headerCell(align: 'left' | 'right', width?: number): React.CSSProperties {
  return {
    textAlign: align,
    padding: '4px 6px',
    borderBottom: '1px solid #ddd',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#666',
    fontSize: 10,
    width,
  };
}

function bodyCell(align: 'left' | 'right'): React.CSSProperties {
  return {
    textAlign: align,
    padding: '4px 6px',
    borderBottom: '1px solid #f0f0f0',
  };
}
