interface Props {
  otsPlan: number;
  otsFact: number;
  label: { plan: string; fact: string; completion: string };
}

export function PrintEfficiency({ otsPlan, otsFact, label }: Props) {
  const pct = otsPlan > 0 ? Math.min(100, Math.round((otsFact / otsPlan) * 100)) : 0;
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 12, background: '#fafafa' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: '#666' }}>{label.plan}: <span className="pdf-mono">{otsPlan.toLocaleString('ru-RU')}</span></span>
        <span style={{ fontSize: 10, color: '#666' }}>{label.fact}: <span className="pdf-mono">{otsFact.toLocaleString('ru-RU')}</span></span>
      </div>
      <div style={{ height: 14, background: '#eee', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#10B981' : '#FF6B2C' }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: '#666' }}>{label.completion}: <span className="pdf-mono">{pct}%</span></div>
    </div>
  );
}
