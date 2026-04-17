'use client';

import { useState } from 'react';

interface CampaignFinancialsProps {
  campaignId: string;
  initialValues: {
    totalBudgetUzs: number | null;
    productionCost: number | null;
    agencyFeePct: number | null;
    totalFinal: number | null;
  };
}

function fmt(n: number | null) {
  if (!n) return '—';
  return n.toLocaleString('ru-RU');
}

export function CampaignFinancials({ campaignId, initialValues }: CampaignFinancialsProps) {
  const [values, setValues] = useState({
    totalBudgetUzs: initialValues.totalBudgetUzs ?? '',
    productionCost: initialValues.productionCost ?? '',
    agencyFeePct: initialValues.agencyFeePct ?? '',
    totalFinal: initialValues.totalFinal ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalBudgetUzs: values.totalBudgetUzs ? Number(values.totalBudgetUzs) : null,
        productionCost: values.productionCost ? Number(values.productionCost) : null,
        agencyFeePct: values.agencyFeePct ? Number(values.agencyFeePct) : null,
        totalFinal: values.totalFinal ? Number(values.totalFinal) : null,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const fields: { key: keyof typeof values; label: string }[] = [
    { key: 'totalBudgetUzs', label: 'Без АК и НДС' },
    { key: 'productionCost', label: 'Производство' },
    { key: 'agencyFeePct', label: 'АК %' },
    { key: 'totalFinal', label: 'Итоговая сумма' },
  ];

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
        Финансовые данные
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-3)]">
              {label}
            </label>
            <input
              type="number"
              value={values[key]}
              onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
              placeholder="0"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>
        ))}
      </div>

      {/* Summary row */}
      {(initialValues.totalBudgetUzs || initialValues.productionCost || initialValues.totalFinal) && (
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-2)]" style={{ fontFamily: 'var(--font-mono)' }}>
          {initialValues.totalBudgetUzs && <span>Без АК: {fmt(initialValues.totalBudgetUzs)} UZS</span>}
          {initialValues.productionCost && <span>Произ.: {fmt(initialValues.productionCost)} UZS</span>}
          {initialValues.agencyFeePct && <span>АК: {initialValues.agencyFeePct}%</span>}
          {initialValues.totalFinal && (
            <span className="font-medium text-[var(--text)]">Итого: {fmt(initialValues.totalFinal)} UZS</span>
          )}
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="mt-4 rounded-[var(--radius-sm)] bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
      >
        {saving ? 'Сохранение...' : saved ? '✓ Сохранено' : 'Сохранить'}
      </button>
    </div>
  );
}
