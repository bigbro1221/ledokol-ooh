interface Cell {
  label: string;
  value: string;
  unit?: string;
}
export function PrintKpiStrip({ cells }: { cells: Cell[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cells.length}, 1fr)`, gap: 6 }}>
      {cells.map(c => (
        <div key={c.label} style={{ border: '1px solid #ddd', borderRadius: 4, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#888' }}>{c.label}</div>
          <div className="pdf-mono" style={{ fontSize: 18, fontWeight: 600, color: '#111', marginTop: 4 }}>
            {c.value}
            {c.unit && <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>{c.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function fmtBig(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('ru-RU');
}
