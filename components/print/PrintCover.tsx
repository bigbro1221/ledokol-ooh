import Image from 'next/image';

interface Props {
  clientName: string;
  campaignName: string;
  periodStart: Date;
  periodEnd: Date;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DRAFT';
  statusLabel: string;
  clientLabel: string;
  generatedOnText: string;
  locale: string;
}

const STATUS_STYLE: Record<Props['status'], { bg: string; color: string }> = {
  ACTIVE:    { bg: 'rgba(16,185,129,0.12)', color: '#059669' },
  PAUSED:    { bg: 'rgba(234,179,8,0.12)',  color: '#D97706' },
  COMPLETED: { bg: '#E2E9F4',               color: '#7E8AA1' },
  DRAFT:     { bg: '#E2E9F4',               color: '#7E8AA1' },
};

function fmtDate(d: Date, locale: string): string {
  return d.toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'uz' ? 'uz-UZ' : 'ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function PrintCover({
  clientName, campaignName, periodStart, periodEnd, status, statusLabel,
  clientLabel, generatedOnText, locale,
}: Props) {
  const s = STATUS_STYLE[status];
  return (
    <div className="pdf-cover">
      <div className="pdf-cover-logo">
        <Image src="/ledokol-logo.svg" alt="Ledokol" width={140} height={36} priority />
      </div>
      <div className="pdf-cover-date">{generatedOnText}</div>

      <div className="pdf-cover-block">
        <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#999' }}>
          {clientLabel}
        </div>
        <div style={{ fontSize: 22, marginTop: 4, color: '#222' }}>{clientName}</div>

        <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 36, fontWeight: 500, marginTop: 24, color: '#111', lineHeight: 1.15, whiteSpace: 'pre-line' }}>
          {campaignName}
        </div>
        <div className="pdf-mono" style={{ fontSize: 14, marginTop: 12, color: '#666' }}>
          {fmtDate(periodStart, locale)} — {fmtDate(periodEnd, locale)}
        </div>

        <div style={{ marginTop: 20 }}>
          <span style={{ display: 'inline-block', padding: '4px 12px', background: s.bg, color: s.color, borderRadius: 9999, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            ● {statusLabel}
          </span>
        </div>
      </div>

      <div className="pdf-cover-footer">
        <span>ledokolgroup.com</span>
        <span>1</span>
      </div>
    </div>
  );
}
