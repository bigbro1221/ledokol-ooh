import Link from 'next/link';
import { type DateFormat, formatCampaignPeriod } from '@/lib/format-period';

export interface CampaignTileData {
  id: string;
  name: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  screensCount: number;
}

interface Props {
  campaign: CampaignTileData;
  href: string;
  locale: string;
  dateFormat: DateFormat;
  statusLabel: string;
  screensLabel: string;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-[rgba(16,185,129,0.12)] text-[var(--success)]',
  PAUSED: 'bg-[rgba(234,179,8,0.12)] text-[var(--warning)]',
  COMPLETED: 'bg-[var(--surface-3)] text-[var(--text-3)]',
  DRAFT: 'bg-[var(--surface-3)] text-[var(--text-3)]',
};

export function CampaignTile({ campaign: c, href, locale, dateFormat, statusLabel, screensLabel }: Props) {
  const period = formatCampaignPeriod(c.periodStart, c.periodEnd, locale, dateFormat);
  return (
    <Link
      href={href}
      className="group relative rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:border-[var(--border-hi)] hover:shadow-[var(--shadow-md)]"
    >
      <span className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] ${STATUS_STYLES[c.status] ?? STATUS_STYLES.DRAFT}`}>
        {c.status === 'ACTIVE' && <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />}
        {statusLabel}
      </span>
      <h3 className="pr-16 text-[18px] font-semibold tracking-tight text-[var(--text)] group-hover:text-[var(--brand-primary)]">
        {c.name}
      </h3>
      <p className="mt-1 text-[13px] text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
        {period}
      </p>
      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">{screensLabel}</p>
          <p className="mt-1 text-[18px] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
            {c.screensCount.toLocaleString('ru-RU')}
          </p>
        </div>
      </div>
    </Link>
  );
}
