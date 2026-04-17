'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Upload, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

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
  _count: { screens: number };
}

interface PeriodManagerProps {
  campaignId: string;
  locale: string;
  initialPeriods: Period[];
}

function fmt(n: number | null) {
  if (!n) return '—';
  return n.toLocaleString('ru-RU');
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
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
        agencyFeePct: financials.agencyFeePct ? Number(financials.agencyFeePct) : null,
        totalFinal: financials.totalFinal ? Number(financials.totalFinal) : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      onSaved(updated);
    }
  }

  async function handleDelete() {
    if (!confirm(`Удалить период "${period.name}"? Все поверхности будут удалены.`)) return;
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
              {new Date(period.periodStart).toLocaleDateString('ru-RU')} — {new Date(period.periodEnd).toLocaleDateString('ru-RU')}
              {' · '}
              {period._count.screens} экр.
              {period.sourceFileUrl && <span className="ml-2 text-[var(--brand-primary)]">✓ XLSX</span>}
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
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">Финансовые данные</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { key: 'totalBudgetUzs', label: 'Без АК и НДС' },
              { key: 'productionCost', label: 'Производство' },
              { key: 'agencyFeePct', label: 'АК %' },
              { key: 'totalFinal', label: 'Итоговая сумма' },
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

          {/* Summary row */}
          {(period.totalBudgetUzs || period.productionCost || period.totalFinal) && (
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-2)]" style={{ fontFamily: 'var(--font-mono)' }}>
              {period.totalBudgetUzs && <span>Без АК: {fmt(period.totalBudgetUzs)} UZS</span>}
              {period.productionCost && <span>Произ.: {fmt(period.productionCost)} UZS</span>}
              {period.agencyFeePct && <span>АК: {period.agencyFeePct}%</span>}
              {period.totalFinal && <span className="font-medium text-[var(--text)]">Итого: {fmt(period.totalFinal)} UZS</span>}
            </div>
          )}

          <button
            onClick={saveFinancials}
            disabled={saving}
            className="mt-3 rounded-[var(--radius-sm)] bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      )}
    </div>
  );
}

export function PeriodManager({ campaignId, locale, initialPeriods }: PeriodManagerProps) {
  const router = useRouter();
  const [periods, setPeriods] = useState<Period[]>(initialPeriods);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ name: '', periodStart: '', periodEnd: '' });

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
      setPeriods(ps => [...ps, { ...created, _count: { screens: 0 } }]);
      setNewPeriod({ name: '', periodStart: '', periodEnd: '' });
      setAdding(false);
      router.refresh();
    }
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
          <p className="mb-3 text-sm font-medium">Новый период</p>
          <div className="space-y-3">
            <input
              placeholder="Название (напр. «Первый флайт»)"
              value={newPeriod.name}
              onChange={e => setNewPeriod(p => ({ ...p, name: e.target.value }))}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-3)]">Начало</label>
                <input
                  type="date"
                  value={newPeriod.periodStart}
                  onChange={e => setNewPeriod(p => ({ ...p, periodStart: e.target.value }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-3)]">Конец</label>
                <input
                  type="date"
                  value={newPeriod.periodEnd}
                  onChange={e => setNewPeriod(p => ({ ...p, periodEnd: e.target.value }))}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={addPeriod} disabled={saving} className="rounded-[var(--radius-sm)] bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50">
              {saving ? '...' : 'Добавить'}
            </button>
            <button onClick={() => setAdding(false)} className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-2)]">
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] py-3 text-sm text-[var(--text-3)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          <Plus size={16} strokeWidth={1.5} />
          Добавить период
        </button>
      )}
    </div>
  );
}
