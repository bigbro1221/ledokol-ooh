'use client';

import { useState } from 'react';

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
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">Поверхности</h3>
          <p className="mt-0.5 text-xs text-[var(--text-3)]">
            {screens.length} поверхностей в кампании
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
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
        <div className="flex items-center justify-center gap-2 border-t border-[var(--border)] px-6 py-3">
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
      )}
    </div>
  );
}
