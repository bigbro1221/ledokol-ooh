'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Trash2, Upload, Plus, Film, Image as ImageIcon } from 'lucide-react';

export interface CreativeRow {
  id: string;
  name: string;
  mimeType: string;
  kind: 'CREATIVE' | 'REPORT';
  width: number | null;
  height: number | null;
  sizeBytes: number;
  durationSec: number | null;
  url: string;
  thumbnailUrl: string | null;
}

interface Props {
  campaignId: string;
  creatives: CreativeRow[];
}

interface UploadState {
  file: File;
  progress: 'queued' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface MediaMeta {
  width: number;
  height: number;
  durationSec: number;
  thumbnail: Blob | null;
}

function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}

function isVideo(mime: string): boolean {
  return mime.startsWith('video/');
}

// Load video metadata + capture a frame as JPEG.
function readVideoMetaAndThumbnail(file: File): Promise<MediaMeta | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);
    const timeoutId = window.setTimeout(() => { cleanup(); resolve(null); }, 15000);

    video.onloadedmetadata = () => {
      const target = Math.min(1, (video.duration || 0) * 0.1);
      video.currentTime = target > 0 ? target : 0;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no ctx');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          window.clearTimeout(timeoutId);
          cleanup();
          resolve({
            width: video.videoWidth || 0,
            height: video.videoHeight || 0,
            durationSec: Number.isFinite(video.duration) ? video.duration : 0,
            thumbnail: blob,
          });
        }, 'image/jpeg', 0.82);
      } catch {
        window.clearTimeout(timeoutId);
        cleanup();
        resolve({
          width: video.videoWidth || 0,
          height: video.videoHeight || 0,
          durationSec: Number.isFinite(video.duration) ? video.duration : 0,
          thumbnail: null,
        });
      }
    };

    video.onerror = () => { window.clearTimeout(timeoutId); cleanup(); resolve(null); };
  });
}

// Read image dimensions; image itself becomes its own preview (no separate
// thumbnail upload — the dashboard falls back to the file URL when there is
// no thumbnailKey).
function readImageMeta(file: File): Promise<MediaMeta | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    const cleanup = () => URL.revokeObjectURL(url);
    const timeoutId = window.setTimeout(() => { cleanup(); resolve(null); }, 15000);

    img.onload = () => {
      window.clearTimeout(timeoutId);
      cleanup();
      resolve({
        width: img.naturalWidth || 0,
        height: img.naturalHeight || 0,
        durationSec: 0,
        thumbnail: null,
      });
    };
    img.onerror = () => { window.clearTimeout(timeoutId); cleanup(); resolve(null); };
    img.src = url;
  });
}

async function readMetaAndThumbnail(file: File): Promise<MediaMeta | null> {
  if (isVideo(file.type)) return readVideoMetaAndThumbnail(file);
  if (isImage(file.type)) return readImageMeta(file);
  return null;
}

function formatSize(bytes: number, tMb: string, tKb: string): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} ${tMb}`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} ${tKb}`;
  return `${bytes} B`;
}

export function CreativesManager({ campaignId, creatives }: Props) {
  const router = useRouter();
  const t = useTranslations('creatives');
  const tc = useTranslations('common');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [playing, setPlaying] = useState<CreativeRow | null>(null);
  const [activeKind, setActiveKind] = useState<'CREATIVE' | 'REPORT'>('CREATIVE');

  const visible = useMemo(
    () => creatives.filter(c => c.kind === activeKind),
    [creatives, activeKind],
  );

  const counts = useMemo(() => ({
    CREATIVE: creatives.filter(c => c.kind === 'CREATIVE').length,
    REPORT: creatives.filter(c => c.kind === 'REPORT').length,
  }), [creatives]);

  const doUpload = useCallback(async (files: File[]) => {
    const queue: UploadState[] = files.map(f => ({ file: f, progress: 'queued' }));
    setUploads(queue);

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      setUploads(prev => prev.map((p, idx) => idx === i ? { ...p, progress: 'uploading' } : p));

      const meta = await readMetaAndThumbnail(item.file);
      const fd = new FormData();
      fd.append('file', item.file);
      fd.append('name', item.file.name.replace(/\.[^.]+$/, ''));
      fd.append('kind', activeKind);
      if (meta) {
        fd.append('width', String(meta.width));
        fd.append('height', String(meta.height));
        if (meta.durationSec > 0) fd.append('durationSec', String(meta.durationSec));
        if (meta.thumbnail) fd.append('thumbnail', meta.thumbnail, 'thumb.jpg');
      }

      try {
        const res = await fetch(`/api/campaigns/${campaignId}/creatives`, { method: 'POST', body: fd });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: t('uploadError') }));
          setUploads(prev => prev.map((p, idx) => idx === i ? { ...p, progress: 'error', error } : p));
        } else {
          setUploads(prev => prev.map((p, idx) => idx === i ? { ...p, progress: 'done' } : p));
        }
      } catch {
        setUploads(prev => prev.map((p, idx) => idx === i ? { ...p, progress: 'error', error: t('uploadError') } : p));
      }
    }

    router.refresh();
    setTimeout(() => setUploads([]), 2000);
  }, [campaignId, router, t, activeKind]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) doUpload(files);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []).filter(
      f => f.type.startsWith('video/') || f.type.startsWith('image/'),
    );
    if (files.length > 0) doUpload(files);
  };

  const onDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    await fetch(`/api/creatives/${id}`, { method: 'DELETE' });
    router.refresh();
  };

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const onRenameSubmit = async (id: string) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    await fetch(`/api/creatives/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    setRenamingId(null);
    router.refresh();
  };

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 flex border-b border-[var(--border)]">
        {(['CREATIVE', 'REPORT'] as const).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => setActiveKind(k)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeKind === k
                ? 'border-b-2 border-[var(--brand-primary)] text-[var(--text)]'
                : 'text-[var(--text-3)] hover:text-[var(--text)]'
            }`}
          >
            {t(k === 'CREATIVE' ? 'tabCreatives' : 'tabReports')}
            <span className="ml-2 text-xs text-[var(--text-3)]">{counts[k]}</span>
          </button>
        ))}
      </div>

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`mb-6 rounded-[var(--radius-lg)] border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-subtle)]'
            : 'border-[var(--border)] bg-[var(--surface-2)]'
        }`}
      >
        <Upload size={22} strokeWidth={1.5} className="mx-auto mb-3 text-[var(--text-3)]" />
        <p className="text-sm text-[var(--text-2)]">{t('dropHere')}</p>
        <p className="my-2 text-[11px] text-[var(--text-4)]">{t('or')}</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)]"
        >
          <Plus size={14} strokeWidth={1.5} />
          {t('pickFiles')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={onPick}
        />
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="mb-6 space-y-2">
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm">
              <span className="flex-1 truncate">{u.file.name}</span>
              <span className={`text-xs ${u.progress === 'error' ? 'text-[var(--danger)]' : 'text-[var(--text-3)]'}`}>
                {u.progress === 'queued' && '…'}
                {u.progress === 'uploading' && `${t('uploading')}…`}
                {u.progress === 'done' && '✓'}
                {u.progress === 'error' && (u.error ?? t('uploadError'))}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Creatives table */}
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="bg-[var(--surface-2)]">
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">{t('tableCreative')}</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">{t('tableName')}</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">{t('tableType')}</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">{t('tableResolution')}</th>
              <th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">{t('tableSize')}</th>
              <th className="w-16 border-b border-[var(--border)]" />
            </tr>
          </thead>
          <tbody>
            {visible.map(c => {
              const img = isImage(c.mimeType);
              const tileSrc = c.thumbnailUrl ?? (img ? c.url : null);
              return (
                <tr key={c.id} className="hover:bg-[var(--surface-2)]">
                  <td className="border-b border-[var(--border)] px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setPlaying(c)}
                      className="group relative block h-[56px] w-[100px] overflow-hidden rounded-[var(--radius-sm)] bg-black"
                      aria-label={c.name}
                    >
                      {tileSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={tileSrc} alt="" className="h-full w-full object-cover" />
                      ) : img ? (
                        <ImageIcon size={20} className="absolute inset-0 m-auto text-[var(--text-4)]" strokeWidth={1.5} />
                      ) : (
                        <Film size={20} className="absolute inset-0 m-auto text-[var(--text-4)]" strokeWidth={1.5} />
                      )}
                      {!img && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                            <polygon points="6,4 20,12 6,20" />
                          </svg>
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-3 text-sm">
                    {renamingId === c.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => onRenameSubmit(c.id)}
                        onKeyDown={e => { if (e.key === 'Enter') onRenameSubmit(c.id); if (e.key === 'Escape') setRenamingId(null); }}
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm focus:border-[var(--border-em)] focus:outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => { setRenamingId(c.id); setRenameValue(c.name); }}
                        className="text-left hover:text-[var(--brand-primary)]"
                        title={t('rename')}
                      >
                        {c.name}
                      </button>
                    )}
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-3 text-sm text-[var(--text-2)]">
                    {img ? t('typeImage') : t('typeVideo')}
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-3 text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                    {c.width && c.height ? `${c.width}x${c.height}` : '—'}
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-3 text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                    {formatSize(c.sizeBytes, t('mb'), t('kb'))}
                  </td>
                  <td className="border-b border-[var(--border)] px-2 py-3 text-right">
                    <button
                      onClick={() => onDelete(c.id)}
                      aria-label={tc('delete')}
                      className="rounded-[var(--radius-sm)] border border-[var(--border)] p-1.5 text-[var(--text-3)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]"
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-[var(--text-3)]">
                  {activeKind === 'CREATIVE' ? t('emptyCreatives') : t('emptyReports')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {playing && <PreviewModal creative={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function PreviewModal({ creative, onClose }: { creative: CreativeRow; onClose: () => void }) {
  const img = isImage(creative.mimeType);
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-4xl overflow-hidden rounded-[var(--radius-lg)] bg-black"
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creative.url}
            alt={creative.name}
            className="block w-full"
            style={{ aspectRatio: creative.width && creative.height ? `${creative.width} / ${creative.height}` : undefined }}
          />
        ) : (
          <video
            src={creative.url}
            controls
            autoPlay
            playsInline
            className="block w-full"
            style={{ aspectRatio: creative.width && creative.height ? `${creative.width} / ${creative.height}` : '16 / 9' }}
          />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
