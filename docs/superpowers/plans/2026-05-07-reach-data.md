# Reach Data (Охват) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-campaign reach (Охват N+) data with plan/fact percentages — admin enters via a modal on the campaign detail page; client sees a compact 3-row card on the campaign dashboard that morphs into a full-list modal on click.

**Architecture:** New first-class `ReachEntry` table cascading on campaign delete, unique on `(campaignId, n)`. Two admin-only-write API routes (GET allowed for the campaign's owner-client too). Admin entry surface is a client-side modal launched from the campaign detail page header. Dashboard card mirrors the existing `ProjectTile` → `ProjectModal` framer-motion `layoutId` pattern (shared box morphs from card to centered modal).

**Tech Stack:** Prisma 6, Next.js 14 App Router, next-intl, Zod, Tailwind, framer-motion (already installed). No new dependencies.

**Spec:** [docs/superpowers/specs/2026-05-07-reach-data-design.md](../specs/2026-05-07-reach-data-design.md)

---

## File map

### Schema
- Modify: `prisma/schema.prisma` — add `ReachEntry` model + back-relation on `Campaign`

### API
- Create: `app/api/campaigns/[id]/reach/route.ts` — GET (admin or owner-client) and PUT (admin only) replace-all

### Pure helper + test
- Create: `lib/reach.ts` — `pickRepresentative(entries)` (selects 1/2/3 rows for the dashboard collapsed view)
- Create: `lib/__tests__/reach.test.ts` — assert-based tests (4 cases: empty, 1, 2, ≥3)

### Admin UI
- Create: `components/admin/reach-data-button.tsx` — client wrapper: action button + modal mount
- Create: `components/admin/reach-data-modal.tsx` — modal with editable rows + add/delete/save
- Modify: `app/[locale]/admin/campaigns/[id]/page.tsx` — drop the new button into the header action row

### Dashboard surface
- Create: `components/dashboard/reach-card.tsx` — collapsed card with shared `layoutId={`reach-${campaignId}`}`
- Create: `components/dashboard/reach-modal.tsx` — full-list modal with same `layoutId`
- Modify: `app/[locale]/dashboard/page.tsx` — include `reachEntries` in the campaign-detail Prisma query, thread through to `<DashboardClient>`
- Modify: `app/[locale]/dashboard/dashboard-client.tsx` — accept `reachEntries` prop, render `<ReachCard>` as the first slot after `<CampaignHero>`

### i18n
- Modify: `messages/ru.json`, `messages/en.json`, `messages/uz.json` — new keys per task

---

## Conventions

- Schema workflow (per `CLAUDE.md`): kill-port → `prisma db push` → `prisma generate` → `tsc --noEmit` → `npm run dev`. Stop the dev server before any prisma command on Windows.
- Pure logic → assert tests via `tsx` runner (`lib/__tests__/run.ts` already exists); UI/API verification → `tsc --noEmit` + manual smoke.
- Conventional Commits. Project memory: never push to remote without explicit user approval.
- After all 8 implementation tasks pass locally, the user pushes to `release` and runs the prod migration. The prod migration command is in Task 8.

---

## Task 1: Schema — add `ReachEntry` table

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1.1: Edit `prisma/schema.prisma`**

In the `Campaign` model, add a back-relation. Place it next to other back-relations (alongside `screens`, `periods`, `creatives`):

```prisma
  reachEntries   ReachEntry[]
```

After the `Campaign` model (or any logical position with the other models), add the new model:

```prisma
model ReachEntry {
  id         String   @id @default(uuid())
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  n          Int
  plan       Float?
  fact       Float?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([campaignId, n])
  @@index([campaignId])
}
```

- [ ] **Step 1.2: Apply the schema in dev**

Run sequentially:

```
npx kill-port 3000
npx prisma db push
npx prisma generate
npx tsc --noEmit
```

Expected: `db push` reports a single new table, no data-loss prompt. `tsc --noEmit` exits 0.

- [ ] **Step 1.3: Restart dev server**

```
npm run dev
```

Run in the background — do not wait for it to exit.

- [ ] **Step 1.4: Commit**

```
git add prisma/schema.prisma
git commit -m "feat(schema): add ReachEntry table for campaign reach (Охват) data"
```

---

## Task 2: Pure helper — `pickRepresentative()` + tests

**Files:**
- Create: `lib/reach.ts`
- Create: `lib/__tests__/reach.test.ts`

### Step 2.1: Write the failing test first

Path: `lib/__tests__/reach.test.ts`

```ts
import assert from 'node:assert/strict';
import { pickRepresentative, type ReachRow } from '../reach';

const r = (n: number, plan: number | null = null, fact: number | null = null): ReachRow => ({
  id: `r${n}`, n, plan, fact,
});

// 1. Empty input → empty output
{
  assert.deepEqual(pickRepresentative([]), []);
}

// 2. Single entry → that one
{
  const out = pickRepresentative([r(1, 10, 8)]);
  assert.equal(out.length, 1);
  assert.equal(out[0].n, 1);
}

// 3. Two entries → both
{
  const out = pickRepresentative([r(1), r(5)]);
  assert.deepEqual(out.map(x => x.n), [1, 5]);
}

// 4. ≥3 entries → first, middle (floor(length/2)), last
{
  const out = pickRepresentative([r(1), r(2), r(3), r(5), r(8), r(13)]);
  // length 6 → middle index = floor(6/2) = 3 → r(5)
  assert.deepEqual(out.map(x => x.n), [1, 5, 13]);
}

// 5. Caller-supplied unsorted input is sorted-asc by n before picking
{
  const out = pickRepresentative([r(5), r(1), r(3)]);
  // sorted: 1, 3, 5 → length 3 → first/middle/last = 1/3/5
  assert.deepEqual(out.map(x => x.n), [1, 3, 5]);
}
```

### Step 2.2: Run the test — expect FAIL

```
npm run test:groups
```

(`test:groups` runs every `*.test.ts` under `lib/__tests__/`.)

Expected: `FAIL: Cannot find module ... ../reach`

### Step 2.3: Implement the helper

Path: `lib/reach.ts`

```ts
export interface ReachRow {
  id: string;
  n: number;
  plan: number | null;
  fact: number | null;
}

/**
 * Pick the rows shown on the dashboard's collapsed Reach card.
 * - 0 entries → []
 * - 1 entry → [that one]
 * - 2 entries → both (sorted)
 * - ≥3 entries → first, middle (floor(length/2)), last (sorted)
 *
 * Always sorts the input by `n` ascending first so the caller doesn't have to.
 */
export function pickRepresentative<T extends ReachRow>(entries: T[]): T[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => a.n - b.n);
  if (sorted.length <= 2) return sorted;
  const first = sorted[0];
  const middle = sorted[Math.floor(sorted.length / 2)];
  const last = sorted[sorted.length - 1];
  return [first, middle, last];
}
```

### Step 2.4: Run the test — expect PASS

```
npm run test:groups
```

Expected: `All N files passed` (where N includes the existing `campaign-groups.test.ts` + the new `reach.test.ts`).

### Step 2.5: Typecheck

```
npx tsc --noEmit
```

Expected: PASS.

### Step 2.6: Commit

```
git add lib/reach.ts lib/__tests__/reach.test.ts
git commit -m "feat(lib): pickRepresentative helper for the reach card collapsed view"
```

---

## Task 3: API — `GET` + `PUT` `/api/campaigns/[id]/reach`

**Files:**
- Create: `app/api/campaigns/[id]/reach/route.ts`

### Step 3.1: Create the route file

Path: `app/api/campaigns/[id]/reach/route.ts`

```ts
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { requireAdmin } from '@/lib/api-auth';

const ReachEntrySchema = z.object({
  n: z.number().int().min(1).max(99),
  plan: z.number().finite().min(0).nullable().optional(),
  fact: z.number().finite().min(0).nullable().optional(),
});

const PutBodySchema = z.object({
  entries: z.array(ReachEntrySchema).max(30),
});

async function readSerialized(campaignId: string) {
  const rows = await prisma.reachEntry.findMany({
    where: { campaignId },
    select: { id: true, n: true, plan: true, fact: true },
    orderBy: { n: 'asc' },
  });
  return rows;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  // Admin can read any campaign's reach. Clients can only read campaigns
  // belonging to their own client_id.
  if (session.user.role === 'CLIENT') {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { client: { select: { users: { where: { id: session.user.id }, select: { id: true } } } } },
    });
    const owns = (campaign?.client?.users?.length ?? 0) > 0;
    if (!owns) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } else if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await readSerialized(id);
  return NextResponse.json(rows);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminAuth = await requireAdmin();
  if (!adminAuth.ok) return adminAuth.response;

  const { id } = await params;
  const body = await request.json();
  const parsed = PutBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }

  // Reject duplicate `n` within the payload (DB enforces too, but bail early for a clean 400).
  const seen = new Set<number>();
  for (const e of parsed.data.entries) {
    if (seen.has(e.n)) {
      return NextResponse.json({ error: 'duplicate_n', n: e.n }, { status: 400 });
    }
    seen.add(e.n);
  }

  // Verify campaign exists.
  const campaign = await prisma.campaign.findUnique({ where: { id }, select: { id: true } });
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Replace-all in a transaction.
  await prisma.$transaction([
    prisma.reachEntry.deleteMany({ where: { campaignId: id } }),
    ...(parsed.data.entries.length > 0
      ? [prisma.reachEntry.createMany({
          data: parsed.data.entries.map(e => ({
            campaignId: id,
            n: e.n,
            plan: e.plan ?? null,
            fact: e.fact ?? null,
          })),
        })]
      : []),
  ]);

  const rows = await readSerialized(id);
  return NextResponse.json(rows);
}
```

### Step 3.2: Verify

```
npx tsc --noEmit
```

Expected: PASS.

Smoke as admin in browser devtools (after restart):

```js
// Empty initially
await fetch('/api/campaigns/<some-campaign-id>/reach').then(r => r.json())
// → []

// PUT three entries
await fetch('/api/campaigns/<some-campaign-id>/reach', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ entries: [
    { n: 1, plan: 47.29, fact: null },
    { n: 5, plan: 38.0, fact: 36.5 },
    { n: 60, plan: 0.06, fact: null },
  ]}),
}).then(r => r.json())
// → array of 3 with ids

// Duplicate n → 400
await fetch('/api/campaigns/<some-campaign-id>/reach', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ entries: [{ n: 1, plan: 1 }, { n: 1, plan: 2 }] }),
}).then(r => r.status)
// → 400
```

### Step 3.3: Commit

```
git add "app/api/campaigns/[id]/reach/route.ts"
git commit -m "feat(api): GET/PUT /api/campaigns/[id]/reach (admin write, client read)"
```

---

## Task 4: i18n keys

**Files:**
- Modify: `messages/ru.json`, `messages/en.json`, `messages/uz.json`

### Step 4.1: Add keys to all three files

Under the `admin` namespace add:

| key | ru | en | uz |
|---|---|---|---|
| reachButton            | Охват                                  | Reach                          | Qamrov                                    |
| reachModalTitle        | Данные охвата                          | Reach data                     | Qamrov ma'lumotlari                       |
| reachColumnReach       | Охват                                  | Reach                          | Qamrov                                    |
| reachColumnPlan        | План                                   | Plan                           | Reja                                      |
| reachColumnFact        | Факт                                   | Fact                           | Fakt                                      |
| reachAddRow            | + Добавить строку                      | + Add row                      | + Qator qo'shish                          |
| reachDeleteRow         | Удалить                                | Delete                         | O'chirish                                 |
| reachSave              | Сохранить                              | Save                           | Saqlash                                   |
| reachCancel            | Отмена                                 | Cancel                         | Bekor qilish                              |
| reachMaxRows           | Максимум 30 строк                      | Max 30 rows                    | Maksimum 30 qator                         |
| reachDuplicateN        | Это значение уже добавлено             | Already added                  | Bu qiymat allaqachon qo'shilgan           |

Under the `dashboard` namespace add:

| key | ru | en | uz |
|---|---|---|---|
| reachCardTitle         | Охват                                  | Reach                          | Qamrov                                    |
| reachModalClose        | Закрыть                                | Close                          | Yopish                                    |
| reachPlanLabel         | План                                   | Plan                           | Reja                                      |
| reachFactLabel         | Факт                                   | Fact                           | Fakt                                      |

Use the Edit tool to insert each pair near other keys in the same namespace. Preserve existing JSON structure exactly.

### Step 4.2: Verify

```
npx tsc --noEmit
```

Expected: PASS (no type-level use yet — just JSON validity).

Open one of the messages files and visually confirm valid JSON (no trailing-comma issues).

### Step 4.3: Commit

```
git add messages/
git commit -m "i18n: add reach (Охват) keys for admin modal + dashboard card"
```

---

## Task 5: Admin entry — `<ReachDataModal>` and `<ReachDataButton>`

**Files:**
- Create: `components/admin/reach-data-modal.tsx`
- Create: `components/admin/reach-data-button.tsx`

### Step 5.1: Create the modal

Path: `components/admin/reach-data-modal.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DraftRow {
  key: string;       // local React key (uuid-like)
  n: string;         // input value, validated to int
  plan: string;      // input value (optional float)
  fact: string;      // input value (optional float)
}

interface ServerRow {
  id: string;
  n: number;
  plan: number | null;
  fact: number | null;
}

interface Props {
  campaignId: string;
  open: boolean;
  onClose: () => void;
}

const MAX_ROWS = 30;

function newKey(): string {
  return `r${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function rowFromServer(s: ServerRow): DraftRow {
  return {
    key: s.id,
    n: String(s.n),
    plan: s.plan != null ? String(s.plan) : '',
    fact: s.fact != null ? String(s.fact) : '',
  };
}

export function ReachDataModal({ campaignId, open, onClose }: Props) {
  const t = useTranslations('admin');
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc dismiss + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Fetch on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/campaigns/${campaignId}/reach`)
      .then(r => (r.ok ? r.json() : Promise.reject(`Error ${r.status}`)))
      .then((data: ServerRow[]) => setRows(data.map(rowFromServer)))
      .catch(err => setError(typeof err === 'string' ? err : 'Network error'))
      .finally(() => setLoading(false));
  }, [open, campaignId]);

  if (!open) return null;

  // Duplicate-n detection (parsed integers only)
  const ns = rows
    .map(r => Number.parseInt(r.n, 10))
    .filter(v => Number.isInteger(v) && v >= 1);
  const dupN = new Set<number>();
  const seen = new Set<number>();
  for (const v of ns) {
    if (seen.has(v)) dupN.add(v);
    seen.add(v);
  }

  const isRowValid = (r: DraftRow) => {
    const n = Number.parseInt(r.n, 10);
    if (!Number.isInteger(n) || n < 1 || n > 99) return false;
    if (dupN.has(n)) return false;
    if (r.plan && Number.isNaN(Number(r.plan))) return false;
    if (r.fact && Number.isNaN(Number(r.fact))) return false;
    return true;
  };
  const allValid = rows.every(isRowValid);
  const canAdd = rows.length < MAX_ROWS;
  const canSave = !saving && !loading && allValid;

  function addRow() {
    const maxN = rows.reduce((max, r) => {
      const v = Number.parseInt(r.n, 10);
      return Number.isInteger(v) && v > max ? v : max;
    }, 0);
    const nextN = Math.min(99, maxN + 1);
    setRows(prev => [...prev, { key: newKey(), n: String(nextN), plan: '', fact: '' }]);
  }

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  }

  function deleteRow(key: string) {
    setRows(prev => prev.filter(r => r.key !== key));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        entries: rows.map(r => ({
          n: Number.parseInt(r.n, 10),
          plan: r.plan ? Number(r.plan) : null,
          fact: r.fact ? Number(r.fact) : null,
        })),
      };
      const res = await fetch(`/api/campaigns/${campaignId}/reach`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `Error ${res.status}`);
        return;
      }
      onClose();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-[15px] font-semibold tracking-tight">{t('reachModalTitle')}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5">
          {loading ? (
            <p className="py-6 text-center text-sm text-[var(--text-3)]">…</p>
          ) : (
            <>
              {/* Header */}
              <div className="mb-2 grid grid-cols-[64px_1fr_1fr_36px] gap-2 px-1 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">
                <div>{t('reachColumnReach')}</div>
                <div>{t('reachColumnPlan')}</div>
                <div>{t('reachColumnFact')}</div>
                <div />
              </div>
              <div className="space-y-2">
                {rows.map(r => {
                  const nVal = Number.parseInt(r.n, 10);
                  const isDup = Number.isInteger(nVal) && dupN.has(nVal);
                  return (
                    <div key={r.key} className="grid grid-cols-[64px_1fr_1fr_36px] items-center gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          step={1}
                          value={r.n}
                          onChange={e => updateRow(r.key, { n: e.target.value })}
                          className={`w-12 rounded-[var(--radius-sm)] border bg-[var(--surface-2)] px-2 py-1.5 text-sm tabular-nums ${isDup ? 'border-[var(--danger)]' : 'border-[var(--border)]'}`}
                        />
                        <span className="text-[var(--text-3)]">+</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={r.plan}
                        onChange={e => updateRow(r.key, { plan: e.target.value })}
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm tabular-nums"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={r.fact}
                        onChange={e => updateRow(r.key, { fact: e.target.value })}
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm tabular-nums"
                      />
                      <button
                        type="button"
                        aria-label={t('reachDeleteRow')}
                        onClick={() => deleteRow(r.key)}
                        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {dupN.size > 0 && (
                <p className="mt-3 text-[12px] text-[var(--danger)]">{t('reachDuplicateN')}</p>
              )}
              <button
                type="button"
                disabled={!canAdd}
                onClick={addRow}
                className="mt-4 w-full rounded-[var(--radius-md)] border border-dashed border-[var(--border)] py-2 text-[12px] text-[var(--text-3)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {canAdd ? t('reachAddRow') : t('reachMaxRows')}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          {error && <span className="mr-auto text-[12px] text-[var(--danger)]">{error}</span>}
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-[13px] hover:bg-[var(--surface-2)]"
          >
            {t('reachCancel')}
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-1.5 text-[13px] font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('reachSave')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

The `t('close')` key is the existing `admin.close` key (already present in all three messages files — confirmed at `messages/ru.json:108`).

### Step 5.2: Create the button wrapper

Path: `components/admin/reach-data-button.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Target } from 'lucide-react';
import { ReachDataModal } from './reach-data-modal';

interface Props {
  campaignId: string;
}

export function ReachDataButton({ campaignId }: Props) {
  const t = useTranslations('admin');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)]"
      >
        <Target size={13} strokeWidth={1.5} /> {t('reachButton')}
      </button>
      <ReachDataModal campaignId={campaignId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
```

### Step 5.3: Verify

```
npx tsc --noEmit
```

Expected: PASS.

### Step 5.4: Commit

```
git add components/admin/reach-data-modal.tsx components/admin/reach-data-button.tsx
git commit -m "feat(admin): ReachDataModal + button for reach (Охват) entry"
```

---

## Task 6: Drop the «Охват» button into the campaign detail header

**Files:**
- Modify: `app/[locale]/admin/campaigns/[id]/page.tsx`

### Step 6.1: Wire the button

Open `app/[locale]/admin/campaigns/[id]/page.tsx`. Locate the action button row inside the header (the `<div className="flex flex-wrap items-center gap-2 sm:shrink-0">` block, around line 122). Add the import at the top:

```ts
import { ReachDataButton } from '@/components/admin/reach-data-button';
```

Inside the action button row, after the `<Film />` Creatives link and before `ClearScreensButton` / `RegeocodeButton` / `DeleteCampaignButton`, insert:

```tsx
<ReachDataButton campaignId={id} />
```

Visible for all campaigns regardless of status (admins may want to enter reach data while still in DRAFT).

### Step 6.2: Verify

```
npx tsc --noEmit
```

Expected: PASS.

Manual smoke: open `/{locale}/admin/campaigns/<id>`. The «Охват» button is in the header row. Clicking it opens the modal. Add a row, save, reopen — the row is persisted.

### Step 6.3: Commit

```
git add "app/[locale]/admin/campaigns/[id]/page.tsx"
git commit -m "feat(admin): wire Охват button into campaign detail header"
```

---

## Task 7: Dashboard data path — load `reachEntries`

**Files:**
- Modify: `app/[locale]/dashboard/page.tsx`
- Modify: `app/[locale]/dashboard/dashboard-client.tsx`

### Step 7.1: Extend the campaign-detail Prisma query

In `app/[locale]/dashboard/page.tsx`, in the campaign-detail branch (when `campaignIdParam` is set), find the `prisma.campaign.findUnique` (or whichever main query loads the selected campaign with its relations). Add to its `include`/`select`:

```ts
reachEntries: {
  select: { id: true, n: true, plan: true, fact: true },
  orderBy: { n: 'asc' },
},
```

If the existing query uses `include`, the addition is straightforward. If it uses `select`, add the same field via `select`. Match whichever style the file already uses for the surrounding relations.

### Step 7.2: Pass to `<DashboardClient>`

Where the page renders `<DashboardClient ...>`, add a new prop:

```tsx
reachEntries={campaign.reachEntries}
```

(Names from the Prisma return shape — already match what we want.)

### Step 7.3: Update `DashboardClient` props

In `app/[locale]/dashboard/dashboard-client.tsx`, extend the `Props` interface:

```ts
  reachEntries: { id: string; n: number; plan: number | null; fact: number | null }[];
```

Add `reachEntries` to the destructured parameters:

```ts
export function DashboardClient({
  locale, userRole, initialDateFormat, campaigns, selectedCampaignId, campaign, kpis,
  budgetByType, totalBudgetFromScreens,
  planVsFactByCity, monthlyByCity, planVsFactByType,
  topScreens, tableScreens, campaignPeriods, mapScreens, cityBreakdown, allCities, availableTypes, filters,
  heatmapEmbedUrl, reportsUrl, hasYandexMap, periodsWithData, selectedPeriods, creatives,
  reachEntries,                                            // ← add
}: Props) {
```

### Step 7.4: Verify

```
npx tsc --noEmit
```

Expected: PASS.

### Step 7.5: Commit

```
git add "app/[locale]/dashboard/page.tsx" "app/[locale]/dashboard/dashboard-client.tsx"
git commit -m "feat(dashboard): thread campaign reachEntries through to DashboardClient"
```

---

## Task 8: Dashboard surface — `<ReachCard>` + `<ReachModal>` with framer morph

**Files:**
- Create: `components/dashboard/reach-card.tsx`
- Create: `components/dashboard/reach-modal.tsx`
- Modify: `app/[locale]/dashboard/dashboard-client.tsx`

### Step 8.1: Create `<ReachModal>`

Path: `components/dashboard/reach-modal.tsx`

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReachRow } from '@/lib/reach';

interface Props {
  campaignId: string;
  rows: ReachRow[];
  onClose: () => void;
}

const morphTransition = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

function fmt(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

export function ReachModal({ campaignId, rows, onClose }: Props) {
  const td = useTranslations('dashboard');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLButtonElement>('[data-close]')?.focus();
  }, []);

  const sorted = [...rows].sort((a, b) => a.n - b.n);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={td('reachCardTitle')}
        layoutId={`reach-${campaignId}`}
        transition={morphTransition}
        className="relative max-h-[85vh] w-[min(90vw,520px)] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.12, duration: 0.22 } }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          className="max-h-[85vh] overflow-y-auto p-6"
        >
          <button
            type="button"
            data-close
            aria-label={td('reachModalClose')}
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
          <h2 className="text-[22px] font-medium tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {td('reachCardTitle')}
          </h2>
          <div className="mt-5 space-y-1.5">
            {sorted.map(r => (
              <div
                key={r.id}
                className="grid grid-cols-[60px_1fr_1fr] items-baseline gap-3 rounded-[var(--radius-sm)] py-2"
              >
                <div className="text-[14px] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                  {r.n}+
                </div>
                <div className="text-[13px]">
                  <span className="mr-1.5 text-[10px] uppercase tracking-[0.06em] text-[var(--text-3)]">
                    {td('reachPlanLabel')}
                  </span>
                  <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{fmt(r.plan)}</span>
                </div>
                <div className="text-[13px]">
                  <span className="mr-1.5 text-[10px] uppercase tracking-[0.06em] text-[var(--text-3)]">
                    {td('reachFactLabel')}
                  </span>
                  <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{fmt(r.fact)}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
```

### Step 8.2: Create `<ReachCard>`

Path: `components/dashboard/reach-card.tsx`

```tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { pickRepresentative, type ReachRow } from '@/lib/reach';
import { ReachModal } from './reach-modal';

interface Props {
  campaignId: string;
  rows: ReachRow[];
}

const morphTransition = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

function fmt(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

export function ReachCard({ campaignId, rows }: Props) {
  const td = useTranslations('dashboard');
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;
  const peek = pickRepresentative(rows);

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        layoutId={`reach-${campaignId}`}
        transition={morphTransition}
        style={{ visibility: open ? 'hidden' : 'visible' }}
        className="mb-6 block w-full rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition-all hover:border-[var(--border-hi)] hover:shadow-[var(--shadow-md)]"
      >
        <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">
          {td('reachCardTitle')}
        </div>
        <div className="space-y-1.5">
          {peek.map(r => (
            <div
              key={r.id}
              className="grid grid-cols-[60px_1fr_1fr] items-baseline gap-3"
            >
              <div className="text-[14px] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                {r.n}+
              </div>
              <div className="text-[13px]">
                <span className="mr-1.5 text-[10px] uppercase tracking-[0.06em] text-[var(--text-3)]">
                  {td('reachPlanLabel')}
                </span>
                <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{fmt(r.plan)}</span>
              </div>
              <div className="text-[13px]">
                <span className="mr-1.5 text-[10px] uppercase tracking-[0.06em] text-[var(--text-3)]">
                  {td('reachFactLabel')}
                </span>
                <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{fmt(r.fact)}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <ReachModal
            key={campaignId}
            campaignId={campaignId}
            rows={rows}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
```

### Step 8.3: Render `<ReachCard>` as the first slot in `DashboardClient`

In `app/[locale]/dashboard/dashboard-client.tsx`, add the import:

```ts
import { ReachCard } from '@/components/dashboard/reach-card';
```

Find the JSX immediately AFTER `<CampaignHero ...>` and BEFORE the filter row (`<div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">`). Insert:

```tsx
<ReachCard campaignId={selectedCampaignId} rows={reachEntries} />
```

This places the card immediately after the hero, ahead of the filter row + EfficiencyStrip.

### Step 8.4: Verify

```
npx tsc --noEmit
npm run lint
npm run test:groups
```

Expected: all clean.

Manual smoke:
1. Open `/{locale}/admin/campaigns/<id>`, click «Охват», add 5 rows, save.
2. Open `/{locale}/dashboard?campaign=<id>`. The Reach card sits between the hero and the filter row, showing 3 rows: first/middle/last.
3. Click the card → modal morphs in, full list rendered.
4. Esc / backdrop / X dismiss morphs back into the card slot.
5. With zero rows for a campaign, the card is absent (no empty state).

### Step 8.5: Commit

```
git add components/dashboard/reach-card.tsx components/dashboard/reach-modal.tsx "app/[locale]/dashboard/dashboard-client.tsx"
git commit -m "feat(dashboard): ReachCard with framer-morph to ReachModal"
```

---

## Task 9: Smoke pass + prod migration prep

This task is verification + prepares the user for the prod-DB migration step that runs after deploy.

### Step 9.1: Run all gates

```
npx tsc --noEmit
npm run lint
npm run test:groups
npm run test:parser
```

Expected: all green.

### Step 9.2: Walk the user journeys

1. Admin creates a campaign, opens it, clicks «Охват», adds 5 entries, saves.
2. Admin reopens the modal — entries persist.
3. Admin removes 2 entries, saves; the count drops in the DB (verify via `prisma studio` or psql).
4. Admin tries duplicate `n` → save button disables, inline error shows.
5. Admin tries 31 rows → "+ Add row" disables at 30.
6. Client (or admin viewing the dashboard) sees the Reach card as the first slot. Hover → unchanged. Click → morph modal opens with all entries. Close → morph back.
7. Campaign with 0 entries → no card on the dashboard.
8. Campaign with 1 entry → card shows 1 row. With 2 → 2 rows. With ≥3 → first/middle/last.

### Step 9.3: Prepare the prod migration

Schema change is purely additive (new `ReachEntry` table + index + unique). Safe.

Two paths to migrate prod after deploy:

**A. From inside the new app container (preferred; the container has Prisma + the new schema):**

```bash
ssh root@204.168.247.229
cd /opt/ooh-dashboard
docker compose exec app node node_modules/prisma/build/index.js db push
```

Expected output: a single `CREATE TABLE`, `CREATE INDEX`, `CREATE UNIQUE INDEX` block applied. No data-loss prompt because nothing is dropped.

**B. SQL fallback if `db push` is blocked for any reason:**

```sql
BEGIN;

CREATE TABLE "ReachEntry" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "plan" DOUBLE PRECISION,
    "fact" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReachEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReachEntry_campaignId_n_key" ON "ReachEntry"("campaignId", "n");
CREATE INDEX "ReachEntry_campaignId_idx" ON "ReachEntry"("campaignId");

ALTER TABLE "ReachEntry"
    ADD CONSTRAINT "ReachEntry_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
```

Save as `migration-prod-reach.sql`, copy to prod, apply via:

```bash
docker compose cp migration-prod-reach.sql db:/tmp/
docker compose exec -T db psql -U postgres -d ooh_dashboard -v ON_ERROR_STOP=1 -f /tmp/migration-prod-reach.sql
```

### Step 9.4: No commit; this is a verification + handoff task

---

## Self-review notes

- **Spec coverage:** every section of the spec maps to a task — schema (Task 1), API (Task 3), validation (Task 3 + Task 5 client-side), admin UI (Task 5 + Task 6), dashboard surface (Task 7 + Task 8), i18n (Task 4), pure-helper test surface (Task 2), prod migration prep (Task 9).
- **No placeholders.** Every code step shows the actual code.
- **Type/name consistency.** `ReachEntry` (Prisma model) ↔ `ReachRow` (`lib/reach.ts` shape) ↔ `ServerRow`/`DraftRow` (modal-local) — names differ where their shapes differ. The shared dashboard shape is `ReachRow { id, n, plan, fact }`, used by both `<ReachCard>` and `<ReachModal>`. The prop name on `DashboardClient` is `reachEntries` (matches the Prisma relation name and the back-relation declared in Task 1).
- **Pre-existing patterns matched:** modal styling mirrors `period-summaries-modal.tsx`; framer-morph mirrors `project-tile.tsx` + `project-modal.tsx`.
- **Out of scope (deferred per spec):** XLSX import of reach data, per-period reach, cross-campaign aggregation, client-side editing.
