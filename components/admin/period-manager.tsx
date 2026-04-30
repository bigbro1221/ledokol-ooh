'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Upload, Trash2, ChevronDown, ChevronUp, Eraser, Check } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

// IMPORTANT: MONTHS_RU is the source of truth for new period names that get
// stored in the DB. Keep it in Russian for DB consistency — old period names
// (already in DB) are RU. Visual chips use the i18n months arrays below.
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function getMonthsInRange(startIso: string, endIso: string): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = [];
  const start = new Date(startIso);
  const end = new Date(endIso);
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  const endY = end.getUTCFullYear();
  const endM = end.getUTCMonth();
  while (y < endY || (y === endY && m <= endM)) {
    result.push({ year: y, month: m });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return result;
}

function monthKey(year: number, month: number) {
  return `${year}-${month}`;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function lastDayOf(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

interface Period {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  sourceFileUrl: string | null;
  totalBudgetUzs: number | null;
  productionCost: number | null;
  agencyFeePct: number | null;
  totalFinal: number | null;
  _count: { metrics: number };
}

interface PeriodManagerProps {
  campaignId: string;
  locale: string;
  initialPeriods: Period[];
  campaignStart: string;
  campaignEnd: string;
}

function PeriodCard({
  period,
  campaignId,
  locale,
  onDelete,
  onSaved,
}: {
  period: Period;
  campaignId: string;
  locale: string;
  onDelete: () => void;
  onSaved: (p: Period) => void;
}) {
  const router = useRouter();
  const tp = useTranslations('period');
  const tc = useTranslations('common');
  const tu = useTranslations('upload');
  const fmtLocale = locale === 'en' ? 'en-US' : locale === 'uz' ? 'uz-UZ' : 'ru-RU';
  const fmt = (n: number | null) => n == null ? '—' : n.toLocaleString(fmtLocale);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clearingXlsx, setClearingXlsx] = useState(false);
  const [screenCount, setScreenCount] = useState(period._count.metrics);
  const [financials, setFinancials] = useState({
    totalBudgetUzs: period.totalBudgetUzs ?? '',
    productionCost: period.productionCost ?? '',
    agencyFeePct: period.agencyFeePct ?? '',
    totalFinal: period.totalFinal ?? '',
  });

  async function saveFinancials() {
    setSaving(true);
    const res = await fetch(`/api/campaigns/${campaignId}/periods/${period.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalBudgetUzs: financials.totalBudgetUzs ? Number(financials.totalBudgetUzs) : null,
        productionCost: financials.productionCost ? Number(financials.productionCost) : null,
        acRate: financials.agencyFeePct ? Number(financials.agencyFeePct) / 100 : 0,
        totalFinal: financials.totalFinal ? Number(financials.totalFinal) : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      onSaved(updated);
    }
  }

  async function handleClearXlsx() {
    if (!confirm(tp('confirmDeleteScreens', { name: period.name }))) return;
    setClearingXlsx(true);
    const res = await fetch(`/api/campaigns/${campaignId}/periods/${period.id}/screens`, { method: 'DELETE' });
    setClearingXlsx(false);
    if (res.ok) {
      setScreenCount(0);
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!confirm(tp('confirmDeleteMonth', { name: period.name }))) return;
    setDeleting(true);
    await fetch(`/api/campaigns/${campaignId}/periods/${period.id}`, { method: 'DELETE' });
    onDelete();
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <div className="flex-1">
            <div className="text-sm font-medium">{period.name}</div>
            <div className="mt-0.5 text-xs text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
              {new Date(period.periodStart).toLocaleDateString(fmtLocale)} — {new Date(period.periodEnd).toLocaleDateString(fmtLocale)}
              {' · '}
              {screenCount} {tu('screensShort')}
              {period.sourceFileUrl && <span className="ml-2 text-[var(--brand-primary)]">{tu('xlsxMark')}</span>}
            </div>
          </div>
          {expanded ? <ChevronUp size={16} className="shrink-0 text-[var(--text-3)]" /> : <ChevronDown size={16} className="shrink-0 text-[var(--text-3)]" />}
        </button>

        <a
          href={`/${locale}/admin/campaigns/${campaignId}/upload?periodId=${period.id}`}
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-primary-hover)]"
        >
          <Upload size={13} strokeWidth={1.5} />
          XLSX
        </a>

        {screenCount > 0 && (
          <button
            onClick={handleClearXlsx}
            disabled={clearingXlsx}
            title={tp('clearScreens')}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-4)] hover:bg-amber-500/10 hover:text-amber-500 disabled:opacity-50"
          >
            <Eraser size={14} strokeWidth={1.5} />
          </button>
        )}

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-4)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
        >
          <Trash2 size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Financials form */}
      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">{tp('financialsTitle')}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { key: 'totalBudgetUzs', label: tp('noVat') },
              { key: 'productionCost', label: tp('production') },
              { key: 'agencyFeePct', label: tp('commissionPct') },
              { key: 'totalFinal', label: tp('finalTotal') },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-3)]">{label}</label>
                <input
                  type="number"
                  value={financials[key as keyof typeof financials]}
                  onChange={e => setFinancials(f => ({ ...f, [key]: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
            ))}
          </div>

          {(period.totalBudgetUzs || period.productionCost || period.totalFinal) && (
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-2)]" style={{ fontFamily: 'var(--font-mono)' }}>
              {period.totalBudgetUzs && <span>{tp('noVatShort')} {fmt(period.totalBudgetUzs)} UZS</span>}
              {period.productionCost && <span>{tp('productionShort')} {fmt(period.productionCost)} UZS</span>}
              {period.agencyFeePct && <span>{tp('commissionShort')} {period.agencyFeePct}%</span>}
              {period.totalFinal && <span className="font-medium text-[var(--text)]">{tp('finalTotalShort')} {fmt(period.totalFinal)} UZS</span>}
            </div>
          )}

          <button
            onClick={saveFinancials}
            disabled={saving}
            className="mt-3 rounded-[var(--radius-sm)] bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
          >
            {saving ? tc('saving') : tc('save')}
          </button>
        </div>
      )}
    </div>
  );
}

export function PeriodManager({ campaignId, locale, initialPeriods, campaignStart, campaignEnd }: PeriodManagerProps) {
  const router = useRouter();
  const tp = useTranslations('period');
  const tc = useTranslations('common');
  const tMonths = useTranslations('months');
  const i18nLocale = useLocale();
  const fmtLocale = i18nLocale === 'en' ? 'en-US' : i18nLocale === 'uz' ? 'uz-UZ' : 'ru-RU';
  // months.short is an array — read it via t.raw to support array indexing
  const monthsShort = (tMonths.raw('short') as string[]) || [];
  const [periods, setPeriods] = useState<Period[]>(initialPeriods);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ name: '', periodStart: '', periodEnd: '' });
  const [selectedMonthValue, setSelectedMonthValue] = useState('');

  const campaignMonths = getMonthsInRange(campaignStart, campaignEnd);
  const multiYear = campaignMonths.some(m => m.year !== campaignMonths[0].year);

  const addedMonthKeys = new Set(
    periods.map(p => {
      const d = new Date(p.periodStart);
      return monthKey(d.getUTCFullYear(), d.getUTCMonth());
    })
  );

  function selectMonth(year: number, month: number) {
    const name = `${MONTHS_RU[month]} ${year}`;
    const last = lastDayOf(year, month);
    const start = `${year}-${pad(month + 1)}-01`;
    const end = `${year}-${pad(month + 1)}-${pad(last)}`;
    setNewPeriod({ name, periodStart: start, periodEnd: end });
    setSelectedMonthValue(`${year}-${pad(month + 1)}`);
  }

  function handleMonthInput(value: string) {
    setSelectedMonthValue(value);
    if (!value) return;
    const [y, m] = value.split('-').map(Number);
    const month = m - 1;
    const name = `${MONTHS_RU[month]} ${y}`;
    const last = lastDayOf(y, month);
    setNewPeriod({
      name,
      periodStart: `${y}-${pad(m)}-01`,
      periodEnd: `${y}-${pad(m)}-${pad(last)}`,
    });
  }

  async function addPeriod() {
    if (!newPeriod.name || !newPeriod.periodStart || !newPeriod.periodEnd) return;
    setSaving(true);
    const res = await fetch(`/api/campaigns/${campaignId}/periods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPeriod),
    });
    setSaving(false);
    if (res.ok) {
      const created = await res.json();
      setPeriods(ps => [...ps, { ...created, _count: { metrics: 0 } }]);
      setNewPeriod({ name: '', periodStart: '', periodEnd: '' });
      setSelectedMonthValue('');
      setAdding(false);
      router.refresh();
    }
  }

  function cancelAdding() {
    setAdding(false);
    setNewPeriod({ name: '', periodStart: '', periodEnd: '' });
    setSelectedMonthValue('');
  }

  return (
    <div className="space-y-3">
      {periods.map(p => (
        <PeriodCard
          key={p.id}
          period={p}
          campaignId={campaignId}
          locale={locale}
          onDelete={() => { setPeriods(ps => ps.filter(x => x.id !== p.id)); router.refresh(); }}
          onSaved={updated => setPeriods(ps => ps.map(x => x.id === updated.id ? { ...x, ...updated } : x))}
        />
      ))}

      {adding ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-sm font-medium">{tp('newMonth')}</p>

          {/* Month chips */}
          {campaignMonths.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {campaignMonths.map(({ year, month }) => {
                const key = monthKey(year, month);
                const isAdded = addedMonthKeys.has(key);
                const isSelected = selectedMonthValue === `${year}-${pad(month + 1)}`;
                const monthLabel = monthsShort[month] ?? '';
                const label = multiYear
                  ? `${monthLabel} '${String(year).slice(2)}`
                  : monthLabel;

                if (isAdded) {
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] text-[var(--text-4)] cursor-default select-none"
                    >
                      <Check size={10} strokeWidth={2} />
                      {label}
                    </span>
                  );
                }

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectMonth(year, month)}
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      isSelected
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                        : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-3">
            {/* Month picker */}
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-3)]">{tp('month')}</label>
              <input
                type="month"
                value={selectedMonthValue}
                min={campaignStart.slice(0, 7)}
                max={campaignEnd.slice(0, 7)}
                onChange={e => handleMonthInput(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]"
              />
            </div>

            {/* Name — auto-filled but editable */}
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-3)]">{tp('name')}</label>
              <input
                placeholder={tp('namePlaceholder')}
                value={newPeriod.name}
                onChange={e => setNewPeriod(p => ({ ...p, name: e.target.value }))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]"
              />
            </div>

            {/* Date range — derived, read-only display */}
            {newPeriod.periodStart && newPeriod.periodEnd && (
              <p className="text-xs text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
                {new Date(newPeriod.periodStart).toLocaleDateString(fmtLocale)} — {new Date(newPeriod.periodEnd).toLocaleDateString(fmtLocale)}
              </p>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={addPeriod}
              disabled={saving || !newPeriod.name || !newPeriod.periodStart}
              className="rounded-[var(--radius-sm)] bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
            >
              {saving ? '...' : tp('add')}
            </button>
            <button
              onClick={cancelAdding}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-2)]"
            >
              {tc('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] py-3 text-sm text-[var(--text-3)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          <Plus size={16} strokeWidth={1.5} />
          {tp('addMonth')}
        </button>
      )}
    </div>
  );
}
