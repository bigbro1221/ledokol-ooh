'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface CampaignFormProps {
  locale: string;
  clients: { id: string; name: string }[];
  initial?: {
    id: string;
    name: string;
    clientId: string;
    periodStart: string;
    periodEnd: string;
    splitByPeriods: boolean;
    heatmapUrl?: string | null;
    yandexMapUrl?: string | null;
  };
}

interface DraftState {
  name: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  splitByPeriods: boolean;
  heatmapUrl: string;
  yandexMapUrl: string;
}

const DRAFT_KEY = 'ledokol_campaign_draft';

function loadDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as DraftState) : null;
  } catch {
    return null;
  }
}

function saveDraft(state: DraftState) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch {}
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

export function CampaignForm({ locale, clients, initial }: CampaignFormProps) {
  const router = useRouter();
  const isEdit = !!initial;

  // All controlled state — seeded from initial (edit) or draft (new)
  const [name, setName] = useState(initial?.name ?? '');
  const [clientId, setClientId] = useState(initial?.clientId ?? '');
  const [periodStart, setPeriodStart] = useState(initial?.periodStart ?? '');
  const [periodEnd, setPeriodEnd] = useState(initial?.periodEnd ?? '');
  const [splitByPeriods, setSplitByPeriods] = useState(initial?.splitByPeriods ?? false);
  const [heatmapUrl, setHeatmapUrl] = useState(initial?.heatmapUrl ?? '');
  const [yandexMapUrl, setYandexMapUrl] = useState(initial?.yandexMapUrl ?? '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);

  // Load draft on mount (new campaigns only)
  useEffect(() => {
    if (isEdit) return;
    const draft = loadDraft();
    if (draft) {
      setName(draft.name);
      setClientId(draft.clientId);
      setPeriodStart(draft.periodStart);
      setPeriodEnd(draft.periodEnd);
      setSplitByPeriods(draft.splitByPeriods);
      setHeatmapUrl(draft.heatmapUrl);
      setYandexMapUrl(draft.yandexMapUrl);
      if (draft.name || draft.clientId) setDraftRestored(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft on every change (new campaigns only).
  // Skip the very first run: on initial render both effects fire in order,
  // and this effect would capture the pre-restore empty closure and overwrite the draft.
  const skipFirstSave = useRef(true);
  useEffect(() => {
    if (isEdit) return;
    if (skipFirstSave.current) { skipFirstSave.current = false; return; }
    saveDraft({ name, clientId, periodStart, periodEnd, splitByPeriods, heatmapUrl, yandexMapUrl });
  }, [isEdit, name, clientId, periodStart, periodEnd, splitByPeriods, heatmapUrl, yandexMapUrl]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const data = {
      name,
      clientId,
      periodStart,
      periodEnd,
      splitByPeriods,
      heatmapUrl: heatmapUrl.trim() || null,
      yandexMapUrl: yandexMapUrl.trim() || null,
    };

    const url = isEdit ? `/api/campaigns/${initial.id}` : '/api/campaigns';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || err.errors?.fieldErrors?.name?.[0] || 'Ошибка сохранения');
        setLoading(false);
        return;
      }
      clearDraft();
      router.push(`/${locale}/admin/campaigns`);
      router.refresh();
    } catch {
      setError('Сетевая ошибка');
      setLoading(false);
    }
  }

  const inputCls = 'w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]';

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">

      {/* Draft restored notice */}
      {draftRestored && (
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--warning)] bg-[rgba(234,179,8,0.08)] px-3 py-2">
          <p className="text-xs text-[var(--warning)]">Восстановлен незаполненный черновик</p>
          <button
            type="button"
            onClick={() => {
              clearDraft();
              setName(''); setClientId(''); setPeriodStart(''); setPeriodEnd('');
              setSplitByPeriods(false); setHeatmapUrl(''); setYandexMapUrl('');
              setDraftRestored(false);
            }}
            className="ml-4 text-[11px] text-[var(--text-3)] underline hover:text-[var(--text)]"
          >
            Очистить
          </button>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          Название кампании
        </label>
        <input
          required
          value={name}
          onChange={e => setName(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          Клиент
        </label>
        <select
          required
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          className={inputCls}
        >
          <option value="">Выберите клиента</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
            Начало
          </label>
          <input
            type="date"
            required
            value={periodStart}
            onChange={e => setPeriodStart(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
            Окончание
          </label>
          <input
            type="date"
            required
            value={periodEnd}
            onChange={e => setPeriodEnd(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Heatmap URL */}
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          Ссылка на тепловую карту (Foursquare)
        </label>
        <input
          type="url"
          placeholder="https://studio.foursquare.com/map/public/..."
          value={heatmapUrl}
          onChange={e => setHeatmapUrl(e.target.value)}
          className={inputCls}
        />
        <p className="mt-1 text-[11px] text-[var(--text-4)]">Ссылка вида /map/public/… будет автоматически преобразована в iframe</p>
      </div>

      {/* Yandex Maps URL */}
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          Ссылка на Яндекс Карты (пины)
        </label>
        <input
          type="url"
          placeholder="https://yandex.uz/maps/..."
          value={yandexMapUrl}
          onChange={e => setYandexMapUrl(e.target.value)}
          className={inputCls}
        />
        <p className="mt-1 text-[11px] text-[var(--text-4)]">Используется для геокодирования пинов при загрузке XLSX</p>
      </div>

      {/* Split by periods toggle */}
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <div className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              className="sr-only"
              checked={splitByPeriods}
              onChange={e => setSplitByPeriods(e.target.checked)}
            />
            <div className={`h-5 w-9 rounded-full transition-colors ${splitByPeriods ? 'bg-[var(--brand-primary)]' : 'bg-[var(--surface-3)]'}`} />
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${splitByPeriods ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <div>
            <div className="text-sm font-medium">Разбить на периоды</div>
            <div className="mt-0.5 text-xs text-[var(--text-3)]">
              Каждый период — отдельный XLSX-файл и финансовые данные (флайты, месяцы)
            </div>
          </div>
        </label>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
        >
          {loading ? '...' : isEdit ? 'Сохранить' : 'Создать'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
