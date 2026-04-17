'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Screen {
  id: string;
  externalId: string | null;
  type: string;
  city: string;
  address: string;
  size: string | null;
  photoUrl: string | null;
  ots: number | null;
}

const TYPE_STYLES: Record<string, string> = {
  LED: 'bg-[rgba(255,107,44,0.12)] text-[var(--chart-1)]',
  STATIC: 'bg-[rgba(59,130,246,0.12)] text-[var(--chart-2)]',
  STOP: 'bg-[rgba(139,92,246,0.12)] text-[var(--chart-3)]',
  AIRPORT: 'bg-[rgba(16,185,129,0.12)] text-[var(--chart-4)]',
  BUS: 'bg-[rgba(245,158,11,0.12)] text-[var(--chart-5)]',
};

const TYPE_LABELS: Record<string, string> = {
  LED: 'LED',
  STATIC: 'Статика',
  STOP: 'Остановки',
  AIRPORT: 'Аэропорт',
  BUS: 'Транспорт',
};

const PAGE_SIZE = 10;

export function ScreensTable({ screens }: { screens: Screen[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(screens.length / PAGE_SIZE);
  const pageScreens = screens.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4 sm:px-6 sm:py-5">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">Поверхности</h3>
          <p className="mt-0.5 text-xs text-[var(--text-3)]">
            {screens.length} поверхностей в кампании
          </p>
        </div>
      </div>

      {/* mobile: <640px — card-per-row layout */}
      <div className="divide-y divide-[var(--border)] sm:hidden">
        {pageScreens.map((s) => (
          <div key={s.id} className="px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] ${TYPE_STYLES[s.type] || ''}`}>
                {TYPE_LABELS[s.type] || s.type}
              </span>
              <span className="text-[12px] font-medium text-[var(--text)]">{s.city}</span>
            </div>
            <div className="mb-2 line-clamp-2 text-[13px] leading-snug text-[var(--text-2)]">
              {s.address}
            </div>
            <div className="flex items-center justify-between text-[12px]" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              <span className="text-[var(--text-3)]">
                {s.size || '—'}
              </span>
              <span className="text-[var(--text)]">
                OTS: {s.ots ? s.ots.toLocaleString('ru-RU') : '—'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--surface-2)]">
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                ID
              </th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                Тип
              </th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                Город
              </th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                Адрес
              </th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                Размер
              </th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                OTS
              </th>
            </tr>
          </thead>
          <tbody>
            {pageScreens.map((s) => (
              <tr key={s.id} className="transition-colors hover:bg-[var(--surface-2)]">
                <td className="border-b border-[var(--border)] px-4 py-3.5 text-xs text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
                  {s.externalId || '—'}
                </td>
                <td className="border-b border-[var(--border)] px-4 py-3.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] ${TYPE_STYLES[s.type] || ''}`}>
                    {TYPE_LABELS[s.type] || s.type}
                  </span>
                </td>
                <td className="border-b border-[var(--border)] px-4 py-3.5 text-[13px]">
                  {s.city}
                </td>
                <td className="max-w-[340px] truncate border-b border-[var(--border)] px-4 py-3.5 text-[13px] text-[var(--text-2)]">
                  {s.address}
                </td>
                <td className="border-b border-[var(--border)] px-4 py-3.5 text-[13px]" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  {s.size || '—'}
                </td>
                <td className="border-b border-[var(--border)] px-4 py-3.5 text-right text-[13px]" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  {s.ots ? s.ots.toLocaleString('ru-RU') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <>
          {/* mobile: <640px — prev/next + "Page X of Y" */}
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 sm:hidden">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              aria-label="Previous page"
              className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-2)] disabled:opacity-30 hover:bg-[var(--surface-2)]"
            >
              <ChevronLeft size={18} strokeWidth={1.5} />
            </button>
            <span className="text-[12px] text-[var(--text-3)]">
              Стр. <span className="font-medium text-[var(--text)]">{page + 1}</span> из {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
              aria-label="Next page"
              className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-2)] disabled:opacity-30 hover:bg-[var(--surface-2)]"
            >
              <ChevronRight size={18} strokeWidth={1.5} />
            </button>
          </div>

          {/* Desktop: numbered pagination */}
          <div className="hidden items-center justify-center gap-2 border-t border-[var(--border)] px-6 py-3 sm:flex">
            {Array.from({ length: Math.min(totalPages, 8) }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-xs transition-colors ${
                  page === i
                    ? 'bg-[var(--brand-primary-subtle)] font-medium text-[var(--brand-primary)]'
                    : 'text-[var(--text-3)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {i + 1}
              </button>
            ))}
            {totalPages > 8 && (
              <span className="text-xs text-[var(--text-4)]">… {totalPages}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
