import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, ExternalLink } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  LED: 'LED',
  STATIC: 'Статика',
  STOP: 'Остановка',
  AIRPORT: 'Аэропорт',
  BUS: 'Транспорт',
};

const TYPE_COLORS: Record<string, string> = {
  LED: 'bg-blue-500/20 text-blue-400',
  STATIC: 'bg-purple-500/20 text-purple-400',
  STOP: 'bg-emerald-500/20 text-emerald-400',
  AIRPORT: 'bg-sky-500/20 text-sky-400',
  BUS: 'bg-orange-500/20 text-orange-400',
};

function fmt(n: bigint | null | undefined): string {
  if (!n) return '—';
  const num = Number(n);
  return num >= 1e6 ? `${(num / 1e6).toFixed(1)}M` : num.toLocaleString('ru-RU');
}

export default async function CampaignScreensPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ periodId?: string }>;
}) {
  const { locale, id } = await params;
  const { periodId } = await searchParams;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      splitByPeriods: true,
      client: { select: { name: true } },
      periods: { select: { id: true, name: true }, orderBy: { periodStart: 'asc' } },
    },
  });

  if (!campaign) notFound();

  const screens = await prisma.screen.findMany({
    where: {
      campaignId: id,
      ...(periodId ? { periodId } : {}),
    },
    select: {
      id: true,
      externalId: true,
      type: true,
      city: true,
      address: true,
      size: true,
      resolution: true,
      photoUrl: true,
      lat: true,
      lng: true,
      periodId: true,
      period: { select: { name: true } },
      pricing: {
        select: {
          priceUnit: true,
          priceDiscounted: true,
          priceTotal: true,
          priceRub: true,
          commissionPct: true,
          agencyFeeAmt: true,
          productionCost: true,
        },
      },
      metrics: {
        select: {
          otsPlan: true,
          ratingPlan: true,
          otsFact: true,
          ratingFact: true,
          universe: true,
        },
      },
    },
    orderBy: [{ city: 'asc' }, { address: 'asc' }],
  });

  const selectedPeriod = periodId
    ? campaign.periods.find(p => p.id === periodId)
    : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/admin/campaigns/${id}`}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-3)] hover:bg-[var(--surface-2)]"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
          </Link>
          <div>
            <p className="text-xs text-[var(--text-3)]">{campaign.client.name} / {campaign.name}</p>
            <h1 className="text-xl font-semibold">
              Поверхности {selectedPeriod ? `— ${selectedPeriod.name}` : ''}
            </h1>
          </div>
        </div>
        <div className="text-sm text-[var(--text-3)]">{screens.length} записей</div>
      </div>

      {/* Period filter tabs */}
      {campaign.splitByPeriods && campaign.periods.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`/${locale}/admin/campaigns/${id}/screens`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              !periodId
                ? 'bg-[var(--brand-primary)] text-white'
                : 'border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface-2)]'
            }`}
          >
            Все периоды
          </Link>
          {campaign.periods.map(p => (
            <Link
              key={p.id}
              href={`/${locale}/admin/campaigns/${id}/screens?periodId=${p.id}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                periodId === p.id
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface-2)]'
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}

      {screens.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-16 text-center">
          <p className="text-sm text-[var(--text-3)]">Нет поверхностей</p>
          <Link
            href={`/${locale}/admin/campaigns/${id}/upload${periodId ? `?periodId=${periodId}` : ''}`}
            className="mt-1 rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            Загрузить XLSX
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">#</th>
                {campaign.splitByPeriods && !periodId && (
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Период</th>
                )}
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Тип</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Город</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Адрес</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Размер</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">OTS план</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">OTS факт</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Стоимость</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Гео</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Фото</th>
              </tr>
            </thead>
            <tbody>
              {screens.map((screen, i) => {
                const price = screen.pricing?.priceTotal ?? screen.pricing?.priceDiscounted ?? screen.pricing?.priceUnit ?? null;
                return (
                  <tr
                    key={screen.id}
                    className={`border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-2)] ${
                      !screen.lat ? 'bg-amber-500/10' : i % 2 === 0 ? '' : 'bg-[var(--surface)]'
                    }`}
                  >
                    <td className="px-3 py-2.5 text-xs text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
                      {screen.externalId || i + 1}
                    </td>
                    {campaign.splitByPeriods && !periodId && (
                      <td className="px-3 py-2.5 text-xs text-[var(--text-2)]">
                        {screen.period?.name || '—'}
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[screen.type] || 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_LABELS[screen.type] || screen.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--text-2)]">{screen.city}</td>
                    <td className="max-w-[240px] px-3 py-2.5 text-xs">
                      <span className="line-clamp-2">{screen.address}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
                      {screen.size || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                      {screen.metrics?.otsPlan ? screen.metrics.otsPlan.toLocaleString('ru-RU') : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                      {screen.metrics?.otsFact ? (
                        <span className={screen.metrics.otsFact >= (screen.metrics.otsPlan ?? 0) ? 'text-green-600' : 'text-amber-600'}>
                          {screen.metrics.otsFact.toLocaleString('ru-RU')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                      {fmt(price)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {screen.lat ? (
                        <a
                          href={`https://maps.yandex.ru/?pt=${screen.lng},${screen.lat}&z=16`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`${screen.lat.toFixed(5)}, ${screen.lng?.toFixed(5)}`}
                          className="inline-flex text-[var(--brand-primary)] hover:opacity-70"
                        >
                          <MapPin size={13} strokeWidth={1.5} />
                        </a>
                      ) : (
                        <span className="text-[10px] text-amber-500" title="Координаты не найдены">?</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {screen.photoUrl ? (
                        <a
                          href={screen.photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex text-[var(--text-3)] hover:text-[var(--brand-primary)]"
                        >
                          <ExternalLink size={12} strokeWidth={1.5} />
                        </a>
                      ) : (
                        <span className="text-[var(--text-4)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {screens.some(s => !s.lat) && (
        <p className="mt-3 text-[11px] text-amber-600">
          <span className="mr-1">⚠</span>
          Строки с жёлтым фоном — координаты не были сопоставлены при загрузке XLSX.
        </p>
      )}
    </div>
  );
}
