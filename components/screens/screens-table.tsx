'use client';

import { useState, useMemo } from 'react';
import { MapPin, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 25;

const TYPE_LABELS: Record<string, string> = {
  LED: 'LED', STATIC: 'Статика', STOP: 'Остановка', AIRPORT: 'Аэропорт', BUS: 'Транспорт',
};

const TYPE_COLORS: Record<string, string> = {
  LED: 'bg-blue-500/20 text-blue-400',
  STATIC: 'bg-purple-500/20 text-purple-400',
  STOP: 'bg-emerald-500/20 text-emerald-400',
  AIRPORT: 'bg-sky-500/20 text-sky-400',
  BUS: 'bg-orange-500/20 text-orange-400',
};

type Loc = 'ru' | 'en' | 'uz';

const L: Record<string, Record<Loc, string>> = {
  wholePeriod:  { ru: 'Весь период',      en: 'Whole period',   uz: 'Butun davr'         },
  allTypes:     { ru: 'Все типы',          en: 'All types',      uz: 'Barcha turlar'      },
  allCities:    { ru: 'Все города',        en: 'All cities',     uz: 'Barcha shaharlar'   },
  allSizes:     { ru: 'Все размеры',       en: 'All sizes',      uz: "Barcha o'lchamlar"  },
  colType:      { ru: 'Тип',              en: 'Type',           uz: 'Tur'                },
  colCity:      { ru: 'Город',            en: 'City',           uz: 'Shahar'             },
  colAddress:   { ru: 'Адрес',            en: 'Address',        uz: 'Manzil'             },
  colOtsPlan:   { ru: 'OTS план',          en: 'OTS plan',       uz: 'OTS reja'           },
  colOtsFact:   { ru: 'OTS факт',          en: 'OTS fact',       uz: 'OTS fakt'           },
  colSize:      { ru: 'Размер',            en: 'Size',           uz: "O'lcham"            },
  colImpDay:    { ru: 'Выходов/день',      en: 'Imp./day',       uz: 'Kunlik'             },
  colPrice:     { ru: 'Стоимость',         en: 'Cost',           uz: 'Narx'               },
  colGeo:       { ru: 'Гео',              en: 'Geo',            uz: 'Geo'                },
  colPhoto:     { ru: 'Фото',             en: 'Photo',          uz: 'Foto'               },
  noScreens:    { ru: 'Нет поверхностей', en: 'No surfaces',    uz: "Yuzalar yo'q"       },
  uploadXlsx:   { ru: 'Загрузить XLSX',   en: 'Upload XLSX',    uz: 'XLSX yuklash'       },
  surfacesUnit: { ru: 'поверхностей',      en: 'surfaces',       uz: 'yuza'               },
  page:         { ru: 'Стр.',             en: 'Page',           uz: 'Bet'                },
  of:           { ru: 'из',               en: 'of',             uz: 'dan'                },
  noCoords:     {
    ru: 'Строки с жёлтым фоном — координаты не были сопоставлены при загрузке XLSX.',
    en: 'Yellow rows — coordinates were not matched during XLSX import.',
    uz: "Sariq qatorlar — koordinatalar XLSX yuklashda topilmadi.",
  },
};

function t(key: string, locale: Loc): string {
  return L[key]?.[locale] ?? L[key]?.ru ?? key;
}

export type ScreenRow = {
  id: string;
  externalId: string | null;
  type: string;
  city: string;
  address: string;
  size: string | null;
  resolution: string | null;
  impressionsPerDay: number | null;
  periodId: string | null;
  periodName: string | null;
  otsPlan: number | null;
  otsFact: number | null;
  price: number | null;
  lat: number | null;
  lng: number | null;
  photoUrl: string | null;
};

type Period = { id: string; name: string };

type Props = {
  campaignId: string;
  locale: Loc;
  screens: ScreenRow[];
  periods: Period[];
  editable: boolean;
  uploadHref?: string;
};

function fmtNum(n: number | null): string {
  if (!n) return '—';
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n.toLocaleString('ru-RU');
}

function groupKey(s: ScreenRow): string {
  return s.externalId ?? `${s.city}||${s.address}`;
}

function aggregateRows(rows: ScreenRow[]): ScreenRow[] {
  const map = new Map<string, ScreenRow>();
  for (const s of rows) {
    const k = groupKey(s);
    if (!map.has(k)) {
      map.set(k, { ...s, periodId: null, periodName: null });
    } else {
      const e = map.get(k)!;
      map.set(k, {
        ...e,
        otsPlan: (e.otsPlan ?? 0) + (s.otsPlan ?? 0),
        otsFact: (e.otsFact ?? 0) + (s.otsFact ?? 0),
        price: (e.price ?? 0) + (s.price ?? 0),
        impressionsPerDay: Math.max(e.impressionsPerDay ?? 0, s.impressionsPerDay ?? 0) || null,
      });
    }
  }
  return Array.from(map.values());
}

export function ScreensTable({ locale, screens, periods, editable, uploadHref }: Props) {
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [page, setPage] = useState(0);

  const hasPeriods = periods.length > 0;

  const wholeRows = useMemo(
    () => (hasPeriods ? aggregateRows(screens) : screens),
    [screens, hasPeriods],
  );

  const periodRows = useMemo(
    () => (selectedPeriodId ? screens.filter(s => s.periodId === selectedPeriodId) : wholeRows),
    [screens, wholeRows, selectedPeriodId],
  );

  const types  = useMemo(() => Array.from(new Set(screens.map(s => s.type))).sort(), [screens]);
  const cities = useMemo(() => Array.from(new Set(screens.map(s => s.city))).sort(), [screens]);
  const sizes  = useMemo(
    () => Array.from(new Set(screens.map(s => s.size).filter((x): x is string => !!x))).sort(),
    [screens],
  );

  const showTypeFilter = types.length > 1;
  const showCityFilter = cities.length > 1;
  const showSizeFilter = sizes.length > 0;

  const filteredRows = useMemo(
    () =>
      periodRows.filter(
        s =>
          (!typeFilter || s.type === typeFilter) &&
          (!cityFilter || s.city === cityFilter) &&
          (!sizeFilter || s.size === sizeFilter),
      ),
    [periodRows, typeFilter, cityFilter, sizeFilter],
  );

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pageRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const selectCls =
    'rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]';

  if (screens.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-16 text-center">
        <p className="text-sm text-[var(--text-3)]">{t('noScreens', locale)}</p>
        {editable && uploadHref && (
          <a
            href={uploadHref}
            className="mt-1 rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            {t('uploadXlsx', locale)}
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Filter / period bar */}
      {(hasPeriods || showTypeFilter || showCityFilter || showSizeFilter) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {hasPeriods && (
            <select
              value={selectedPeriodId}
              onChange={e => { setSelectedPeriodId(e.target.value); setPage(0); }}
              className={selectCls}
            >
              <option value="">{t('wholePeriod', locale)}</option>
              {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {showTypeFilter && (
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
              className={selectCls}
            >
              <option value="">{t('allTypes', locale)}</option>
              {types.map(tp => <option key={tp} value={tp}>{TYPE_LABELS[tp] || tp}</option>)}
            </select>
          )}
          {showCityFilter && (
            <select
              value={cityFilter}
              onChange={e => { setCityFilter(e.target.value); setPage(0); }}
              className={selectCls}
            >
              <option value="">{t('allCities', locale)}</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {showSizeFilter && (
            <select
              value={sizeFilter}
              onChange={e => { setSizeFilter(e.target.value); setPage(0); }}
              className={selectCls}
            >
              <option value="">{t('allSizes', locale)}</option>
              {sizes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <span className="ml-auto text-xs text-[var(--text-3)]">
            {filteredRows.length} {t('surfacesUnit', locale)}
          </span>
        </div>
      )}

      {/* Mobile card list */}
      <div className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] sm:hidden">
        {pageRows.map(s => (
          <div key={s.id} className={`px-4 py-3 ${editable && !s.lat ? 'bg-amber-500/10' : ''}`}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] ${TYPE_COLORS[s.type] || ''}`}>
                {TYPE_LABELS[s.type] || s.type}
              </span>
              <span className="text-xs font-medium">{s.city}</span>
            </div>
            <p className="mb-1.5 line-clamp-2 text-[13px] text-[var(--text-2)]">{s.address}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              <span className="text-[var(--text-3)]">{s.size || '—'}</span>
              <span>Plan: {fmtNum(s.otsPlan)}</span>
              {s.otsFact != null && s.otsFact > 0 && <span>Fact: {fmtNum(s.otsFact)}</span>}
              {s.impressionsPerDay != null && <span>{s.impressionsPerDay}/d</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">#</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">{t('colType', locale)}</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">{t('colCity', locale)}</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">{t('colAddress', locale)}</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">{t('colOtsPlan', locale)}</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">{t('colOtsFact', locale)}</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">{t('colSize', locale)}</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">{t('colImpDay', locale)}</th>
              {editable && <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">{t('colPrice', locale)}</th>}
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">{t('colGeo', locale)}</th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">{t('colPhoto', locale)}</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((s, i) => {
              const rowIdx = page * PAGE_SIZE + i + 1;
              const otsPct = s.otsPlan && s.otsFact ? (s.otsFact / s.otsPlan) : null;
              return (
                <tr
                  key={s.id}
                  className={`border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-2)] ${
                    editable && !s.lat ? 'bg-amber-500/10' : ''
                  }`}
                >
                  <td className="px-3 py-2.5 text-xs text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
                    {s.externalId || rowIdx}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[s.type] || 'bg-gray-100 text-gray-600'}`}>
                      {TYPE_LABELS[s.type] || s.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[var(--text-2)]">{s.city}</td>
                  <td className="max-w-[240px] px-3 py-2.5 text-xs">
                    <span className="line-clamp-2">{s.address}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtNum(s.otsPlan)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                    {s.otsFact != null && s.otsFact > 0 ? (
                      <span className={otsPct !== null && otsPct >= 1 ? 'text-green-600' : 'text-amber-600'}>
                        {fmtNum(s.otsFact)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
                    {s.size || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-[var(--text-2)]" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                    {s.impressionsPerDay != null ? s.impressionsPerDay.toLocaleString('ru-RU') : '—'}
                  </td>
                  {editable && (
                    <td className="px-3 py-2.5 text-right text-xs" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtNum(s.price)}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-center">
                    {s.lat ? (
                      <a
                        href={`https://maps.yandex.ru/?pt=${s.lng},${s.lat}&z=16`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${s.lat.toFixed(5)}, ${s.lng?.toFixed(5)}`}
                        className="inline-flex text-[var(--brand-primary)] hover:opacity-70"
                      >
                        <MapPin size={13} strokeWidth={1.5} />
                      </a>
                    ) : (
                      <span className="text-[10px] text-amber-500" title="Координаты не найдены">?</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {s.photoUrl ? (
                      <a
                        href={s.photoUrl}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <>
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 sm:hidden">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} aria-label="Previous page"
              className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-2)] disabled:opacity-30 hover:bg-[var(--surface-2)]">
              <ChevronLeft size={18} strokeWidth={1.5} />
            </button>
            <span className="text-[12px] text-[var(--text-3)]">
              {t('page', locale)} <span className="font-medium text-[var(--text)]">{page + 1}</span> {t('of', locale)} {totalPages}
            </span>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1} aria-label="Next page"
              className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-2)] disabled:opacity-30 hover:bg-[var(--surface-2)]">
              <ChevronRight size={18} strokeWidth={1.5} />
            </button>
          </div>
          <div className="hidden items-center justify-center gap-2 border-t border-[var(--border)] px-6 py-3 sm:flex">
            {Array.from({ length: Math.min(totalPages, 8) }, (_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-xs transition-colors ${
                  page === i ? 'bg-[var(--brand-primary-subtle)] font-medium text-[var(--brand-primary)]' : 'text-[var(--text-3)] hover:bg-[var(--surface-2)]'
                }`}>
                {i + 1}
              </button>
            ))}
            {totalPages > 8 && <span className="text-xs text-[var(--text-4)]">… {totalPages}</span>}
          </div>
        </>
      )}

      {/* No-coords legend — admin only */}
      {editable && filteredRows.some(s => !s.lat) && (
        <p className="mt-3 text-[11px] text-amber-600">
          <span className="mr-1">⚠</span>
          {t('noCoords', locale)}
        </p>
      )}
    </div>
  );
}
