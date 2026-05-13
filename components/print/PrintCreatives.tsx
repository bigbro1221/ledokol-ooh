interface Creative {
  id: string;
  name: string;
  kind: string;
  thumbnailUrl: string | null;
  url: string;
}

export function PrintCreatives({ creatives, openLabel }: { creatives: Creative[]; openLabel: string }) {
  if (creatives.length === 0) {
    return <p style={{ fontSize: 10, color: '#999' }}>—</p>;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {creatives.map(c => (
        <div key={c.id} style={{ border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden' }}>
          {c.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.thumbnailUrl} alt={c.name} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: 90, background: '#f3f3f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#888' }}>
              {c.kind}
            </div>
          )}
          <div style={{ padding: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
            <a href={c.url} style={{ fontSize: 8, color: '#FF6B2C', textDecoration: 'none' }}>{openLabel} →</a>
          </div>
        </div>
      ))}
    </div>
  );
}
