interface ReachRow { n: number; plan: number | null; fact: number | null; }
interface Props { entries: ReachRow[]; planLabel: string; factLabel: string; }

export function PrintReach({ entries, planLabel, factLabel }: Props) {
  if (entries.length === 0) return null;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
      <thead>
        <tr>
          <th style={cell('left')}>Охват</th>
          <th style={cell('right')}>{planLabel}</th>
          <th style={cell('right')}>{factLabel}</th>
          <th style={cell('right')}>%</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(e => (
          <tr key={e.n}>
            <td style={cell('left')}>{e.n}+</td>
            <td style={cell('right')} className="pdf-mono">{e.plan?.toFixed(1) ?? '—'}</td>
            <td style={cell('right')} className="pdf-mono">{e.fact?.toFixed(1) ?? '—'}</td>
            <td style={cell('right')} className="pdf-mono">{e.plan && e.fact ? Math.round((e.fact / e.plan) * 100) + '%' : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function cell(align: 'left' | 'right'): React.CSSProperties {
  return { textAlign: align, padding: '4px 6px', borderBottom: '1px solid #eee', fontWeight: 600 };
}
