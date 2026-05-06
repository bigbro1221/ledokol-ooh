'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';

interface CampaignFinancialsProps {
  campaignId: string;
  // VAT rate active at this campaign's periodStart — used for the live totalFinal
  // preview. Server is authoritative on save.
  vatRate: number;
  initialValues: {
    totalBudgetUzs: number | null;
    productionCost: number | null;
    agencyFeePct: number | null;
    totalFinal: number | null;
  };
}

export function CampaignFinancials({ campaignId, vatRate, initialValues }: CampaignFinancialsProps) {
  const tp = useTranslations('period');
  const tc = useTranslations('common');
  const tf = useTranslations('forms');
  const locale = useLocale();
  const fmtLocale = locale === 'en' ? 'en-US' : locale === 'uz' ? 'uz-UZ' : 'ru-RU';
  const fmt = (n: number | null) => n == null ? '—' : n.toLocaleString(fmtLocale);

  const [values, setValues] = useState({
    totalBudgetUzs: initialValues.totalBudgetUzs != null ? String(initialValues.totalBudgetUzs) : '',
    productionCost: initialValues.productionCost != null ? String(initialValues.productionCost) : '',
    agencyFeePct: initialValues.agencyFeePct != null ? String(initialValues.agencyFeePct) : '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Live derivations from the typed numbers. Returns null when the base is
  // empty so the UI can render "—" instead of "0 UZS".
  const derived = useMemo(() => {
    const base = parseFloat(values.totalBudgetUzs);
    const acPct = parseFloat(values.agencyFeePct);
    const acFraction = isFinite(acPct) ? acPct / 100 : 0;
    if (!isFinite(base)) {
      return { base: null, withAk: null, totalFinal: null };
    }
    const withAk = base * (1 + acFraction);
    const totalFinal = withAk * (1 + vatRate);
    return { base, withAk, totalFinal };
  }, [values.totalBudgetUzs, values.agencyFeePct, vatRate]);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalBudgetUzs: values.totalBudgetUzs ? Number(values.totalBudgetUzs) : null,
        productionCost: values.productionCost ? Number(values.productionCost) : null,
        acRate: values.agencyFeePct ? Number(values.agencyFeePct) / 100 : 0,
        // totalFinal echoed for legacy server compat; server-side this surface
        // saves SCREENS-mode campaigns and stores the value verbatim.
        totalFinal: derived.totalFinal != null ? Math.round(derived.totalFinal) : null,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
        {tp('financialsTitle')}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-3)]">
            {tp('noVat')}
          </label>
          <input
            type="number"
            value={values.totalBudgetUzs}
            onChange={e => setValues(v => ({ ...v, totalBudgetUzs: e.target.value }))}
            placeholder="0"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-3)]">
            {tp('production')}
          </label>
          <input
            type="number"
            value={values.productionCost}
            onChange={e => setValues(v => ({ ...v, productionCost: e.target.value }))}
            placeholder="0"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-3)]">
            {tp('commissionPct')}
          </label>
          <input
            type="number"
            value={values.agencyFeePct}
            onChange={e => setValues(v => ({ ...v, agencyFeePct: e.target.value }))}
            placeholder="0"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-3)]">
            {tp('finalTotal')}
          </label>
          {/* Computed live as base × (1 + AK%) × (1 + VAT). The VAT% is shown
              as a small badge so the admin can spot if the rate looks off. */}
          <div
            aria-readonly="true"
            className="flex w-full items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text-2)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            <span>{derived.totalFinal != null ? fmt(Math.round(derived.totalFinal)) : '—'}</span>
            <span className="text-[10px] text-[var(--text-4)]">
              {tf('vatPreview', { pct: (vatRate * 100).toFixed(0) })}
            </span>
          </div>
        </div>
      </div>

      {/* Summary row — recomputes live as the user types. */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-2)]" style={{ fontFamily: 'var(--font-mono)' }}>
        {derived.base != null && <span>{tp('noVatShort')} {fmt(Math.round(derived.base))} UZS</span>}
        {values.productionCost && <span>{tp('productionShort')} {fmt(Number(values.productionCost))} UZS</span>}
        {values.agencyFeePct && <span>{tp('commissionShort')} {values.agencyFeePct}%</span>}
        {derived.totalFinal != null && (
          <span className="font-medium text-[var(--text)]">{tp('finalTotalShort')} {fmt(Math.round(derived.totalFinal))} UZS</span>
        )}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-4 rounded-[var(--radius-sm)] bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
      >
        {saving ? tc('saving') : saved ? tp('savedCheck') : tc('save')}
      </button>
    </div>
  );
}
