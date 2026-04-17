'use client';

import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Check, AlertTriangle } from 'lucide-react';

interface ParsePreview {
  campaignId: string;
  periodId: string | null;
  minioKey: string;
  campaign: { clientName: string; yandexMapUrl: string | null; totalBudgetUzs: number | null; totalBudgetRub: number | null };
  screens: Record<string, unknown>[];
  errors: { sheet: string; row: number; field: string; message: string }[];
  warnings: { sheet: string; message: string }[];
  geocoding: { matchedCount: number; unmatchedPins: unknown[]; totalPins: number };
  summary: { totalScreens: number; byType: Record<string, number> };
}

const TYPE_LABELS: Record<string, string> = {
  LED: 'LED экраны',
  STATIC: 'Статика',
  STOP: 'Остановки',
  AIRPORT: 'Аэропорт',
  BUS: 'Транспорт',
};

export function UploadDropzone({ campaignId, locale, periodId }: { campaignId: string; locale: string; periodId?: string | null }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Только .xlsx файлы');
      return;
    }
    setUploading(true);
    setError('');
    setPreview(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('campaignId', campaignId);
    if (periodId) fd.append('periodId', periodId);

    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    setUploading(false);

    if (!res.ok) {
      setError('Ошибка загрузки файла');
      return;
    }

    setPreview(await res.json());
  }, [campaignId]);

  const handleConfirm = async () => {
    if (!preview) return;
    setConfirming(true);

    const res = await fetch(`/api/upload/${campaignId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screens: preview.screens,
        periodId: preview.periodId || null,
        minioKey: preview.minioKey,
        yandexMapUrl: preview.campaign.yandexMapUrl,
        totalBudgetUzs: preview.campaign.totalBudgetUzs,
        totalBudgetRub: preview.campaign.totalBudgetRub,
      }),
    });

    setConfirming(false);
    if (res.ok) {
      setDone(true);
    } else {
      setError('Ошибка сохранения данных');
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--success)] bg-[rgba(16,185,129,0.06)] p-12 text-center">
        <Check size={48} className="text-[var(--success)]" strokeWidth={1.5} />
        <h3 className="text-lg font-semibold">Данные загружены</h3>
        <p className="text-sm text-[var(--text-3)]">
          {preview?.summary.totalScreens} поверхностей добавлено в кампанию
        </p>
        <a
          href={`/${locale}/admin/campaigns/${campaignId}`}
          className="mt-2 rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white"
        >
          К кампании
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        className={`flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border-2 border-dashed p-12 text-center transition-colors ${
          dragOver ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-subtle)]' : 'border-[var(--border)] hover:border-[var(--border-hi)]'
        }`}
      >
        {uploading ? (
          <>
            <FileSpreadsheet size={40} className="animate-pulse text-[var(--brand-primary)]" strokeWidth={1.5} />
            <p className="text-sm text-[var(--text-2)]">Парсинг файла...</p>
          </>
        ) : (
          <>
            <Upload size={40} className="text-[var(--text-4)]" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium">Перетащите XLSX файл сюда</p>
              <p className="mt-1 text-xs text-[var(--text-3)]">или</p>
            </div>
            <label className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]">
              Выбрать файл
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }} />
            </label>
          </>
        )}
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="mb-4 text-[15px] font-semibold">Результат парсинга</h3>

            {/* Summary */}
            <div className="mb-4 grid grid-cols-3 gap-4">
              <div className="rounded-[var(--radius-md)] bg-[var(--surface-2)] p-4">
                <div className="text-2xl font-semibold">{preview.summary.totalScreens}</div>
                <div className="text-xs text-[var(--text-3)]">Поверхностей</div>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--surface-2)] p-4">
                <div className="text-2xl font-semibold">{preview.errors.length}</div>
                <div className="text-xs text-[var(--text-3)]">Ошибок</div>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--surface-2)] p-4">
                <div className="text-2xl font-semibold">{preview.geocoding.matchedCount}/{preview.geocoding.totalPins}</div>
                <div className="text-xs text-[var(--text-3)]">Пинов совпало</div>
              </div>
            </div>

            {/* By type */}
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">По типам</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(preview.summary.byType).map(([type, count]) => (
                  <span key={type} className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs">
                    {TYPE_LABELS[type] || type}: <strong>{count}</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Errors */}
            {preview.errors.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--warning)]">
                  <AlertTriangle size={14} /> Ошибки валидации ({preview.errors.length})
                </h4>
                <div className="max-h-40 overflow-y-auto rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-3 text-xs">
                  {preview.errors.slice(0, 20).map((err, i) => (
                    <div key={i} className="text-[var(--text-2)]">
                      {err.sheet} строка {err.row}: {err.field} — {err.message}
                    </div>
                  ))}
                  {preview.errors.length > 20 && (
                    <div className="mt-1 text-[var(--text-3)]">...и ещё {preview.errors.length - 20}</div>
                  )}
                </div>
              </div>
            )}

            {/* Warnings */}
            {preview.warnings.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">Предупреждения</h4>
                {preview.warnings.map((w, i) => (
                  <div key={i} className="text-xs text-[var(--text-3)]">{w.sheet}: {w.message}</div>
                ))}
              </div>
            )}

            {/* Unmatched pins */}
            {preview.geocoding.unmatchedPins.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
                  Несопоставленные пины ({preview.geocoding.unmatchedPins.length})
                </h4>
                <p className="text-xs text-[var(--text-3)]">
                  Эти пины с Яндекс Карт не удалось сопоставить с адресами из таблицы.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
            >
              {confirming ? 'Сохранение...' : `Подтвердить загрузку (${preview.summary.totalScreens} поверхностей)`}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2.5 text-sm transition-colors hover:bg-[var(--surface-2)]"
            >
              Отменить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
