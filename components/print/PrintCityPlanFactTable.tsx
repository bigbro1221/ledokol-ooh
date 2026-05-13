/**
 * Per-city plan-vs-fact OTS table for the PDF. Layout:
 *   | Город | (visual bar: plan/fact stacked) | План | Факт | % |
 * The bar cell shows two thin horizontal strips (plan on top, fact below),
 * scaled to the max plan across all rows so cities are comparable.
 * Pure HTML — no Recharts.
 */
import { fmtBig } from './PrintKpiStrip';

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

const PLAN_COLOR = '#3B82F6';
const FACT_COLOR = '#FF6B2C';
const TROUGH_COLOR = '#F1F3F6';

export function PrintCityPlanFactTable({ rows, cityLabel, planLabel, factLabel }: Props) {
  if (rows.length === 0) return null;
  // The bar cell's scale is anchored to plan only — that's what the user wants
  // to read first; over-delivery (fact > plan) still renders proportionally
  // because we apply the same divisor to both bars.
  const maxPlan = Math.max(...rows.map(r => r.plan), 1);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
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
          const planPct = (r.plan / maxPlan) * 100;
          const factPct = (r.fact / maxPlan) * 100;
          const completion = r.plan > 0 ? Math.round((r.fact / r.plan) * 100) : null;
          return (
            <tr key={r.city}>
              <td style={bodyCell('left')}>{r.city}</td>
              <td style={{ ...bodyCell('left'), paddingTop: 6, paddingBottom: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div
                    style={{
                      position: 'relative',
                      height: 6,
                      background: TROUGH_COLOR,
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ position: 'absolute', inset: 0, width: `${planPct}%`, background: PLAN_COLOR }} />
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      height: 6,
                      background: TROUGH_COLOR,
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ position: 'absolute', inset: 0, width: `${factPct}%`, background: FACT_COLOR }} />
                  </div>
                </div>
              </td>
              <td style={{ ...bodyCell('right'), color: PLAN_COLOR, fontWeight: 600 }} className="pdf-mono">
                {fmtBig(r.plan)}
              </td>
              <td style={{ ...bodyCell('right'), color: FACT_COLOR, fontWeight: 600 }} className="pdf-mono">
                {fmtBig(r.fact)}
              </td>
              <td style={bodyCell('right')} className="pdf-mono">
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
    fontSize: 9,
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
