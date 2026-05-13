# PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an "Export to PDF" button on the campaign-detail dashboard that downloads a multi-page A4 portrait report via a print route + headless Chromium.

**Architecture:** New auth-checked print route renders campaign data with print-specific components. New API route launches a singleton Puppeteer browser, forwards the user's session cookie, navigates to the print route on `localhost:3000`, waits for `[data-pdf-ready="1"]`, returns a PDF buffer. Dashboard gets one new button; everything else is additive.

**Tech Stack:** Next.js 14 App Router, `puppeteer-core` + system Chromium (Alpine package), NextAuth v5, Prisma 6, next-intl, Recharts, Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-13-pdf-export-design.md`

---

## Phase 1 — Infrastructure

### Task 1: Add puppeteer-core dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install puppeteer-core**

Run: `npm install puppeteer-core@^23.0.0`

Expected: `package.json` gets a new `dependencies` entry for `puppeteer-core`. `package-lock.json` updates.

- [ ] **Step 2: Verify TypeScript types resolve**

Run: `node -e "import('puppeteer-core').then(p => console.log('types ok', !!p.default))"`

Expected: prints `types ok true`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(pdf): add puppeteer-core dependency"
```

---

### Task 2: Install Chromium in the Docker image

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.prod.yml`

- [ ] **Step 1: Add Chromium install + env to Dockerfile**

In `Dockerfile`, find the runner stage (the final stage that runs the app). Add Chromium install BEFORE the `CMD`/`USER` line:

```dockerfile
# Chromium for PDF export (puppeteer-core uses the system binary)
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

If the runner stage uses a non-root user, ensure `apk add` runs while still root (move it before the `USER` directive).

- [ ] **Step 2: Bump shm_size in prod compose**

In `docker-compose.prod.yml`, find the `app` service and add `shm_size: 1gb` under it:

```yaml
  app:
    image: ghcr.io/bigbro1221/ledokol-ooh:latest
    shm_size: 1gb
    # ... existing keys
```

- [ ] **Step 3: Build the image locally to verify**

Run: `docker build -t ooh-test .`

Expected: build completes; final stage has chromium-browser at `/usr/bin/chromium-browser`. Verify:

```bash
docker run --rm ooh-test which chromium-browser
# Expected: /usr/bin/chromium-browser
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile docker-compose.prod.yml
git commit -m "feat(pdf): install chromium in prod image for PDF export"
```

---

### Task 3: Extract `getCampaignForDashboard` into a shared module

**Files:**
- Create: `lib/campaign-detail.ts`
- Modify: `app/[locale]/dashboard/page.tsx`

This is a refactor only — no behaviour change. Pulls the big inline `campaign.findUnique({...})` out so the print route can call the same query.

- [ ] **Step 1: Create the helper module**

Create `lib/campaign-detail.ts`:

```ts
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

type CampaignDetailInclude = ReturnType<typeof buildInclude>;
type CampaignDetailReturn = Prisma.CampaignGetPayload<{ include: CampaignDetailInclude }>;

function buildInclude(screenWhere: Prisma.ScreenWhereInput | undefined) {
  return {
    client: { select: { name: true } },
    periods: {
      select: { id: true, name: true, totalBudgetUzs: true, totalFinal: true, periodStart: true, periodEnd: true },
      orderBy: { periodStart: 'asc' as const },
    },
    reachEntries: {
      select: { id: true, n: true, plan: true, fact: true, pinned: true },
      orderBy: { n: 'asc' as const },
    },
    screens: {
      where: screenWhere && Object.keys(screenWhere).length > 0 ? screenWhere : undefined,
      select: {
        id: true, externalId: true, city: true, address: true,
        resolution: true, photoUrl: true, lat: true, lng: true,
        screenType: { select: { code: true } },
        metrics: {
          select: {
            periodId: true,
            size: true,
            impressionsPerDay: true,
            otsPlan: true, ratingPlan: true, otsFact: true, ratingFact: true,
          },
        },
        pricing: { select: { periodId: true, priceUnit: true, priceDiscounted: true, priceTotal: true, agencyFeeAmt: true } },
      },
    },
  } as const;
}

/**
 * Loads a campaign with everything dashboard + print routes need.
 * Returns null if the campaign doesn't exist or the user can't access it.
 *
 * `screenWhere` is the optional filter applied by URL search params
 * (city/type/period). Pass undefined for the unfiltered version (PDF
 * route always passes undefined).
 */
export async function getCampaignForDashboard(
  campaignId: string,
  userScope: { clientFilter: Prisma.CampaignWhereInput },
  screenWhere?: Prisma.ScreenWhereInput,
): Promise<CampaignDetailReturn | null> {
  return prisma.campaign.findFirst({
    where: { id: campaignId, ...userScope.clientFilter },
    include: buildInclude(screenWhere),
  });
}

export type DashboardCampaign = NonNullable<Awaited<ReturnType<typeof getCampaignForDashboard>>>;
```

- [ ] **Step 2: Replace the inline query in dashboard/page.tsx**

In `app/[locale]/dashboard/page.tsx`, find the existing `const [campaign, prefs] = await Promise.all([prisma.campaign.findUnique({...`. Replace the `prisma.campaign.findUnique({...})` call with:

```ts
getCampaignForDashboard(
  selectedId,
  { clientFilter },
  screenWhere,
),
```

Add the import at the top:

```ts
import { getCampaignForDashboard } from '@/lib/campaign-detail';
```

Adjust the `if (!campaign) redirect(...)` check — the new function returns `null` on both "not found" and "not allowed", which is the same behaviour as before (the previous code paired `findUnique` with a `clientFilter` check that returned a redirect on mismatch).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

Expected: zero errors.

- [ ] **Step 4: Smoke test the dashboard**

Run: `npm run dev`, log in, visit `/ru/dashboard?campaign=<any-id>`. Page should look identical to before.

- [ ] **Step 5: Commit**

```bash
git add lib/campaign-detail.ts app/\[locale\]/dashboard/page.tsx
git commit -m "refactor(dashboard): extract getCampaignForDashboard for reuse"
```

---

### Task 4: Build slug.ts (TDD)

**Files:**
- Create: `lib/pdf/slug.ts`
- Create: `lib/pdf/__tests__/slug.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/pdf/__tests__/slug.test.ts`:

```ts
import { describe, it, expect } from 'node:test';
import assert from 'node:assert/strict';
import { slugForFilename } from '../slug';

describe('slugForFilename', () => {
  it('lowercases ASCII and joins with -', () => {
    assert.equal(slugForFilename('Hello World'), 'hello-world');
  });

  it('transliterates Cyrillic', () => {
    assert.equal(slugForFilename('РК Geely - 2 flight'), 'rk-geely-2-flight');
  });

  it('strips punctuation and collapses runs of -', () => {
    assert.equal(slugForFilename('Foo!!Bar...Baz'), 'foo-bar-baz');
  });

  it('trims leading and trailing -', () => {
    assert.equal(slugForFilename('--Foo--'), 'foo');
  });

  it('handles empty input', () => {
    assert.equal(slugForFilename(''), '');
  });

  it('handles unknown chars by dropping them', () => {
    assert.equal(slugForFilename('Café 北京 — bar'), 'cafe-bar');
  });
});
```

- [ ] **Step 2: Run test to see it fail**

Run: `npx tsx --test lib/pdf/__tests__/slug.test.ts`

Expected: fails because `lib/pdf/slug.ts` doesn't exist.

- [ ] **Step 3: Write minimal implementation**

Create `lib/pdf/slug.ts`:

```ts
const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya',
  ъ: '', ь: '',
};

const ACCENT_MAP: Record<string, string> = {
  á: 'a', à: 'a', ä: 'a', â: 'a', ã: 'a',
  é: 'e', è: 'e', ë: 'e', ê: 'e',
  í: 'i', ì: 'i', ï: 'i', î: 'i',
  ó: 'o', ò: 'o', ö: 'o', ô: 'o', õ: 'o',
  ú: 'u', ù: 'u', ü: 'u', û: 'u',
  ñ: 'n', ç: 'c',
};

/**
 * Transliterates Cyrillic + strips diacritics + slugifies.
 * Non-Latin/non-mapped chars are dropped silently. Empty input returns "".
 */
export function slugForFilename(input: string): string {
  const lower = input.toLowerCase();
  let out = '';
  for (const ch of lower) {
    if (CYRILLIC_MAP[ch] !== undefined) out += CYRILLIC_MAP[ch];
    else if (ACCENT_MAP[ch] !== undefined) out += ACCENT_MAP[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (/\s|[-_./]/.test(ch)) out += '-';
    // anything else (other scripts, symbols) drops
  }
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '');
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx tsx --test lib/pdf/__tests__/slug.test.ts`

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/pdf/slug.ts lib/pdf/__tests__/slug.test.ts
git commit -m "feat(pdf): add slugForFilename for PDF filenames"
```

---

### Task 5: Build the Puppeteer render helper

**Files:**
- Create: `lib/pdf/render.ts`

This is the singleton browser + render function. No automated tests — Puppeteer requires Chromium at runtime; we verify manually in Task 13.

- [ ] **Step 1: Create the helper**

Create `lib/pdf/render.ts`:

```ts
import 'server-only';
import puppeteer, { type Browser, type PDFOptions } from 'puppeteer-core';

let browserPromise: Promise<Browser> | null = null;
let pdfCount = 0;
const RECYCLE_AFTER = 200;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
      headless: true,
    });
  }
  return browserPromise;
}

async function recycleIfNeeded() {
  pdfCount++;
  if (pdfCount < RECYCLE_AFTER) return;
  pdfCount = 0;
  const old = browserPromise;
  browserPromise = null;
  if (old) {
    const b = await old;
    await b.close().catch(() => {});
  }
}

export interface RenderOptions {
  url: string;
  sessionCookie: { name: string; value: string };
  cookieDomain: string;        // e.g. "localhost"
  locale: string;              // for headerTemplate text only
  headerLeft: string;          // campaign + client
  headerRight: string;         // period range
  footerLeft: string;          // "Generated dd.mm.yyyy"
  waitTimeoutMs?: number;      // default 30000
}

export async function renderCampaignPdf(opts: RenderOptions): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    await page.setCookie({
      name: opts.sessionCookie.name,
      value: opts.sessionCookie.value,
      domain: opts.cookieDomain,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    });

    await page.goto(opts.url, { waitUntil: 'networkidle0', timeout: opts.waitTimeoutMs ?? 30000 });
    await page.waitForSelector('[data-pdf-ready="1"]', { timeout: opts.waitTimeoutMs ?? 30000 });

    const pdfOptions: PDFOptions = {
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '14mm', right: '14mm' },
      displayHeaderFooter: true,
      printBackground: true,
      headerTemplate: buildHeaderTemplate(opts),
      footerTemplate: buildFooterTemplate(opts),
    };
    const pdf = await page.pdf(pdfOptions);
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await recycleIfNeeded();
  }
}

function buildHeaderTemplate(o: RenderOptions): string {
  // Puppeteer header/footer templates run in an isolated context — inline
  // styles only, no external CSS. Page number / total via the .pageNumber /
  // .totalPages classes. The :first-child :not approach hides the chrome on
  // page 1 (the cover): the cover renders its own header/footer in the body,
  // and the @page first selector in print.css zeros margins for page 1
  // separately so this template renders into the cover's reserved space and
  // we let it overlap-but-be-invisible. Simpler: just render nothing on the
  // cover by checking pageNumber === 1.
  return `
    <div style="width:100%;font-size:9px;font-family:sans-serif;color:#999;padding:0 14mm;box-sizing:border-box;">
      <div class="page-header" style="display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding-bottom:4px;">
        <span class="hide-first">${escapeHtml(o.headerLeft)}</span>
        <span class="hide-first">${escapeHtml(o.headerRight)}</span>
      </div>
    </div>
    <style>
      .page-header { visibility: visible; }
    </style>
  `;
}

function buildFooterTemplate(o: RenderOptions): string {
  return `
    <div style="width:100%;font-size:9px;font-family:sans-serif;color:#999;padding:0 14mm;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;border-top:1px solid #ddd;padding-top:4px;">
        <span>${escapeHtml(o.footerLeft)}</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
```

> **Note on first-page chrome:** Puppeteer's header/footer templates render on every page including page 1. To keep the cover clean, the cover page itself reserves whitespace at the top/bottom (matching the 20mm margins) and the user simply sees the template content rendered above and below the cover content. This is fine for the cover layout since the template content is small (9px) and consistent — the cover's own header (logo + "generated on") sits comfortably below it. If we want page 1 to be truly chromeless, that's a follow-up: render the cover as a separate PDF page with `displayHeaderFooter: false`, then concatenate — out of scope here.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add lib/pdf/render.ts
git commit -m "feat(pdf): puppeteer singleton + renderCampaignPdf helper"
```

---

### Task 6: Add the `pdf` translation namespace

**Files:**
- Modify: `messages/ru.json`
- Modify: `messages/en.json`
- Modify: `messages/uz.json`

- [ ] **Step 1: Add the `pdf` namespace to ru.json**

In `messages/ru.json`, add a top-level `pdf` key:

```json
"pdf": {
  "exportButton": "Экспорт в PDF",
  "exporting": "Готовлю PDF…",
  "exportError": "Не удалось создать PDF. Попробуйте ещё раз.",
  "exportTimeout": "PDF создаётся слишком долго. Попробуйте позже.",
  "generatedOn": "Сгенерировано {date}",
  "coverClient": "Клиент",
  "pageOf": "{n} из {total}",
  "section": {
    "summary": "Сводка",
    "efficiency": "Эффективность и охват",
    "monthly": "План / Факт по месяцам",
    "breakdown": "Разбивка",
    "topScreens": "Топ поверхностей",
    "creatives": "Креативы",
    "screens": "Поверхности"
  },
  "creativePlay": "Открыть"
}
```

- [ ] **Step 2: Add the same keys to en.json (English values)**

```json
"pdf": {
  "exportButton": "Export to PDF",
  "exporting": "Preparing PDF…",
  "exportError": "Could not generate PDF. Please try again.",
  "exportTimeout": "PDF generation took too long. Please try again.",
  "generatedOn": "Generated {date}",
  "coverClient": "Client",
  "pageOf": "{n} of {total}",
  "section": {
    "summary": "Summary",
    "efficiency": "Efficiency & Reach",
    "monthly": "Plan / Fact by month",
    "breakdown": "Breakdown",
    "topScreens": "Top surfaces",
    "creatives": "Creatives",
    "screens": "Surfaces"
  },
  "creativePlay": "Open"
}
```

- [ ] **Step 3: Add the same keys to uz.json (Uzbek values)**

```json
"pdf": {
  "exportButton": "PDF eksport qilish",
  "exporting": "PDF tayyorlanmoqda…",
  "exportError": "PDF yaratib bo'lmadi. Qayta urinib ko'ring.",
  "exportTimeout": "PDF yaratish juda uzoq davom etdi. Keyinroq urinib ko'ring.",
  "generatedOn": "{date} sanasida yaratilgan",
  "coverClient": "Mijoz",
  "pageOf": "{n} / {total}",
  "section": {
    "summary": "Umumiy",
    "efficiency": "Samaradorlik va qamrov",
    "monthly": "Reja / Fakt oylar bo'yicha",
    "breakdown": "Taqsimot",
    "topScreens": "Eng yaxshi yuzalar",
    "creatives": "Kreativlar",
    "screens": "Yuzalar"
  },
  "creativePlay": "Ochish"
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`

Expected: zero errors (next-intl will accept new keys).

- [ ] **Step 5: Commit**

```bash
git add messages/
git commit -m "i18n: add pdf namespace (ru/en/uz)"
```

---

## Phase 2 — Print route skeleton

### Task 7: Build print CSS

**Files:**
- Create: `app/[locale]/print/print.css`

- [ ] **Step 1: Create the stylesheet**

```css
/* PDF-only styles. Loaded by app/[locale]/print/campaign/[id]/page.tsx
 * via a CSS-Module-style import. Browsers print at @page A4. */

@page {
  size: A4 portrait;
  margin: 0;
}

/* Body fills the page edge to edge; sections add their own padding so the
 * cover can claim the full sheet without inherited margins. */
.pdf-root {
  font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
  color: #111;
  background: #fff;
  font-size: 11px;
  line-height: 1.45;
}

.pdf-page {
  page-break-after: always;
  padding: 14mm;
  min-height: calc(297mm - 40mm);
}
.pdf-page:last-child { page-break-after: auto; }

.pdf-section {
  break-inside: avoid;
  margin-bottom: 14mm;
}
.pdf-section:last-child { margin-bottom: 0; }

.pdf-section-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #444;
  margin-bottom: 6mm;
}

/* Mono numerics */
.pdf-mono {
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-variant-numeric: tabular-nums;
}

/* Cover-specific layout — full-bleed inside the @page margins */
.pdf-cover {
  page-break-after: always;
  height: 297mm;
  width: 210mm;
  padding: 20mm 16mm;
  position: relative;
  box-sizing: border-box;
}
.pdf-cover-logo { position: absolute; top: 20mm; left: 16mm; }
.pdf-cover-date { position: absolute; top: 20mm; right: 16mm; font-size: 11px; color: #999; }
.pdf-cover-block { position: absolute; top: 40%; left: 16mm; right: 16mm; }
.pdf-cover-footer { position: absolute; bottom: 16mm; left: 16mm; right: 16mm; font-size: 10px; color: #999; display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding-top: 3mm; }

/* Screens table — print scale */
.pdf-screens-table { width: 100%; border-collapse: collapse; font-size: 9px; }
.pdf-screens-table th {
  text-align: left;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #666;
  padding: 4px 6px;
  border-bottom: 1px solid #ddd;
}
.pdf-screens-table td {
  padding: 4px 6px;
  border-bottom: 1px solid #f0f0f0;
}
.pdf-screens-table tr { break-inside: avoid; }
.pdf-screens-table .num { text-align: right; }
.pdf-screens-table .num { font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace); }

/* Hide anything not meant for print */
.pdf-hide { display: none !important; }
```

- [ ] **Step 2: Commit**

```bash
git add app/\[locale\]/print/print.css
git commit -m "feat(pdf): print stylesheet for A4 layout + page breaks"
```

---

### Task 8: Build PrintSection + PrintReadyFlag

**Files:**
- Create: `components/print/PrintSection.tsx`
- Create: `components/print/PrintReadyFlag.tsx`

- [ ] **Step 1: Create PrintSection**

```tsx
// components/print/PrintSection.tsx
interface Props {
  title?: string;
  children: React.ReactNode;
}

export function PrintSection({ title, children }: Props) {
  return (
    <section className="pdf-section">
      {title && <h2 className="pdf-section-title">{title}</h2>}
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Create PrintReadyFlag (client component)**

```tsx
// components/print/PrintReadyFlag.tsx
'use client';

import { useEffect, useState } from 'react';

/**
 * Sets `data-pdf-ready="1"` on its root after fonts have loaded and the
 * next two animation frames have settled. Puppeteer waits on this attribute
 * before invoking page.pdf().
 */
export function PrintReadyFlag() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if ('fonts' in document) await (document as Document & { fonts: { ready: Promise<void> } }).fonts.ready;
      // Two RAFs give Recharts time to commit its SVG paths.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await new Promise(r => setTimeout(r, 250));
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  return <div data-pdf-ready={ready ? '1' : '0'} aria-hidden style={{ position: 'fixed', inset: 'auto 0 0 0', height: 0 }} />;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add components/print/
git commit -m "feat(pdf): PrintSection + PrintReadyFlag building blocks"
```

---

### Task 9: Build PrintCover

**Files:**
- Create: `components/print/PrintCover.tsx`

- [ ] **Step 1: Create the cover component**

```tsx
// components/print/PrintCover.tsx
import Image from 'next/image';

interface Props {
  clientName: string;
  campaignName: string;
  periodStart: Date;
  periodEnd: Date;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DRAFT';
  statusLabel: string;
  clientLabel: string;
  generatedOnLabel: string;
  generatedAt: Date;
  locale: string;
}

const STATUS_STYLE: Record<Props['status'], { bg: string; color: string }> = {
  ACTIVE:    { bg: 'rgba(16,185,129,0.12)', color: '#059669' },
  PAUSED:    { bg: 'rgba(234,179,8,0.12)',  color: '#D97706' },
  COMPLETED: { bg: '#E2E9F4',               color: '#7E8AA1' },
  DRAFT:     { bg: '#E2E9F4',               color: '#7E8AA1' },
};

function fmtDate(d: Date, locale: string): string {
  return d.toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'uz' ? 'uz-UZ' : 'ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function PrintCover({
  clientName, campaignName, periodStart, periodEnd, status, statusLabel,
  clientLabel, generatedOnLabel, generatedAt, locale,
}: Props) {
  const s = STATUS_STYLE[status];
  return (
    <div className="pdf-cover">
      <div className="pdf-cover-logo">
        <Image src="/ledokol-logo.svg" alt="Ledokol" width={140} height={36} priority />
      </div>
      <div className="pdf-cover-date">{generatedOnLabel.replace('{date}', fmtDate(generatedAt, locale))}</div>

      <div className="pdf-cover-block">
        <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#999' }}>
          {clientLabel}
        </div>
        <div style={{ fontSize: 22, marginTop: 4, color: '#222' }}>{clientName}</div>

        <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 36, fontWeight: 500, marginTop: 24, color: '#111', lineHeight: 1.15 }}>
          {campaignName}
        </div>
        <div className="pdf-mono" style={{ fontSize: 14, marginTop: 12, color: '#666' }}>
          {fmtDate(periodStart, locale)} — {fmtDate(periodEnd, locale)}
        </div>

        <div style={{ marginTop: 20 }}>
          <span style={{ display: 'inline-block', padding: '4px 12px', background: s.bg, color: s.color, borderRadius: 9999, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            ● {statusLabel}
          </span>
        </div>
      </div>

      <div className="pdf-cover-footer">
        <span>ledokolgroup.com</span>
        <span>1</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add components/print/PrintCover.tsx
git commit -m "feat(pdf): PrintCover component"
```

---

### Task 10: Build the print route skeleton

**Files:**
- Create: `app/[locale]/print/campaign/[id]/page.tsx`

This renders the cover plus placeholders for each section. Sections get populated in Phase 4.

- [ ] **Step 1: Create the page**

```tsx
// app/[locale]/print/campaign/[id]/page.tsx
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getCampaignForDashboard } from '@/lib/campaign-detail';
import type { Prisma } from '@prisma/client';
import { PrintCover } from '@/components/print/PrintCover';
import { PrintReadyFlag } from '@/components/print/PrintReadyFlag';
import { PrintSection } from '@/components/print/PrintSection';
import '../../../print/print.css';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ locale: string; id: string }>;
}

export default async function PrintCampaignPage({ params }: Params) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const clientFilter: Prisma.CampaignWhereInput =
    session.user.role === 'CLIENT' && session.user.clientId
      ? { client: { users: { some: { id: session.user.id } } } }
      : {};

  const campaign = await getCampaignForDashboard(id, { clientFilter });
  if (!campaign) notFound();

  const tPdf = await getTranslations({ locale, namespace: 'pdf' });
  const tStatus = await getTranslations({ locale, namespace: 'campaignStatus' });

  return (
    <div className="pdf-root">
      <PrintCover
        clientName={campaign.client.name}
        campaignName={campaign.name}
        periodStart={campaign.periodStart}
        periodEnd={campaign.periodEnd}
        status={campaign.status}
        statusLabel={tStatus(campaign.status)}
        clientLabel={tPdf('coverClient')}
        generatedOnLabel={tPdf('generatedOn')}
        generatedAt={new Date()}
        locale={locale}
      />

      <div className="pdf-page">
        <PrintSection title={tPdf('section.summary')}>
          <p>Summary placeholder — KPI strip goes here (Task 14).</p>
        </PrintSection>
      </div>

      <PrintReadyFlag />
    </div>
  );
}
```

- [ ] **Step 2: Smoke test in browser**

Run `npm run dev`, log in, visit `/ru/print/campaign/<id>`. Should see the cover page rendered + a "Summary placeholder" block.

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/print/campaign/[id]/page.tsx"
git commit -m "feat(pdf): print route skeleton renders cover + placeholder"
```

---

## Phase 3 — PDF API

### Task 11: Build the PDF API route

**Files:**
- Create: `app/api/campaigns/[id]/pdf/route.ts`

- [ ] **Step 1: Create the route**

```ts
// app/api/campaigns/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { renderCampaignPdf } from '@/lib/pdf/render';
import { slugForFilename } from '@/lib/pdf/slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { id: campaignId } = await params;

  // Auth scope: client users only see their own campaigns; admins see everything.
  const clientFilter =
    session.user.role === 'CLIENT' && session.user.clientId
      ? { client: { users: { some: { id: session.user.id } } } }
      : {};
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ...clientFilter },
    select: { id: true, name: true, periodStart: true, periodEnd: true, client: { select: { name: true } } },
  });
  if (!campaign) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Forward the user's session cookie into Puppeteer's browser context.
  const cookieName = req.cookies.get('__Secure-authjs.session-token')
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';
  const cookieValue = req.cookies.get(cookieName)?.value;
  if (!cookieValue) {
    return NextResponse.json({ error: 'no_session_cookie' }, { status: 401 });
  }

  // Use the locale from the Referer so the PDF matches the user's current view.
  const referer = req.headers.get('referer') || '';
  const localeMatch = referer.match(/\/(ru|en|uz)\//);
  const locale = (localeMatch?.[1] ?? 'ru') as 'ru' | 'en' | 'uz';

  const printUrl = `http://localhost:3000/${locale}/print/campaign/${campaignId}`;

  const periodFmt = `${campaign.periodStart.toLocaleDateString(localeForFormat(locale))} — ${campaign.periodEnd.toLocaleDateString(localeForFormat(locale))}`;
  const generatedAtFmt = new Date().toLocaleDateString(localeForFormat(locale));

  try {
    const buffer = await renderCampaignPdf({
      url: printUrl,
      sessionCookie: { name: cookieName, value: cookieValue },
      cookieDomain: 'localhost',
      locale,
      headerLeft: `${campaign.name} · ${campaign.client.name}`,
      headerRight: periodFmt,
      footerLeft: generatedAtFmt,
    });

    const filename = [
      slugForFilename(campaign.client.name),
      slugForFilename(campaign.name),
      new Date().toISOString().slice(0, 10),
    ].filter(Boolean).join('-') + '.pdf';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /timeout|TimeoutError/i.test(message) ? 504 : 500;
    console.error('[pdf] render failed:', { campaignId, message });
    return NextResponse.json(
      { error: status === 504 ? 'pdf_render_timeout' : 'pdf_render_failed' },
      { status },
    );
  }
}

function localeForFormat(l: 'ru' | 'en' | 'uz'): string {
  return l === 'en' ? 'en-US' : l === 'uz' ? 'uz-UZ' : 'ru-RU';
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/campaigns/[id]/pdf/route.ts"
git commit -m "feat(pdf): /api/campaigns/[id]/pdf route with Puppeteer + auth"
```

---

### Task 12: End-to-end skeleton verification

This is a manual verification task — no code changes. If the skeleton works, every subsequent section is purely additive.

- [ ] **Step 1: Build + run prod-like locally**

Run: `npm run build && npm run start`

(In production-ish mode so the standalone build matches what runs on the VPS.)

- [ ] **Step 2: Hit the PDF endpoint with a real session**

Log in via the browser, copy the session cookie value, then:

```bash
curl -s -o /tmp/test.pdf -w "%{http_code} %{content_type}\n" \
  -H "Cookie: authjs.session-token=<paste-value-here>" \
  -H "Referer: http://localhost:3000/ru/dashboard?campaign=<id>" \
  "http://localhost:3000/api/campaigns/<id>/pdf"
```

Expected: `200 application/pdf`, file size > 0.

If Puppeteer launch fails locally (no Chromium installed on Windows host), skip to running in Docker: `docker compose up` then exec into the app container and run the curl from inside.

- [ ] **Step 3: Open the PDF, verify cover renders**

Open `/tmp/test.pdf` in any PDF reader. Expected:
- Page 1 = cover with Ledokol logo, client name, campaign title, period, status pill
- Page 2 = a placeholder "Summary" section
- Per-page header (from page 2 on) shows campaign + period
- Per-page footer shows the generated date and "2 / 2"

If anything is wrong, fix BEFORE proceeding to Phase 4.

- [ ] **Step 4: Commit a tiny doc note if you adjusted anything**

If Step 3 required code tweaks, commit them with a clear message. Otherwise skip.

---

## Phase 4 — Port sections one at a time

Each task below adds one section to the print route. The dashboard math/aggregation that today lives in `dashboard/page.tsx` (lines ~280–470) needs to be available to the print route too. To avoid duplicating the math, **extract the aggregation into `lib/campaign-detail.ts` as it's needed** — pull `pickLatest`, `filterMetrics`, `screenPriceTotal`, the totals reducers, into named exports. The print route imports them.

### Task 13: Port KPI strip (Summary section)

**Files:**
- Modify: `lib/campaign-detail.ts` — export aggregator helpers
- Modify: `app/[locale]/dashboard/page.tsx` — import the same helpers
- Create: `components/print/PrintKpiStrip.tsx`
- Modify: `app/[locale]/print/campaign/[id]/page.tsx`

- [ ] **Step 1: Extract aggregators**

In `lib/campaign-detail.ts`, add at the bottom:

```ts
import type { DashboardCampaign } from './campaign-detail';
type Screen = DashboardCampaign['screens'][number];
type Metric = Screen['metrics'][number];

export function pickLatest<T>(vals: (T | null)[]): T | null {
  for (let i = vals.length - 1; i >= 0; i--) if (vals[i] != null) return vals[i];
  return null;
}

export function screenPriceTotal(s: Screen): number {
  return s.pricing.reduce((sum, p) => {
    if (p.priceDiscounted) return sum + Number(p.priceDiscounted);
    if (p.priceTotal)      return sum + Number(p.priceTotal);
    if (p.priceUnit)       return sum + Number(p.priceUnit);
    return sum;
  }, 0);
}

export function totalsForCampaign(c: DashboardCampaign): {
  totalBudget: number; totalScreens: number; otsPlan: number; otsFact: number;
} {
  const totalScreens = c.screens.length;
  const otsPlan = c.screens.reduce((sum, s) => sum + s.metrics.reduce((m, x) => m + (x.otsPlan ?? 0), 0), 0);
  const otsFact = c.screens.reduce((sum, s) => sum + s.metrics.reduce((m, x) => m + (x.otsFact ?? 0), 0), 0);
  const totalBudget = c.screens.reduce((sum, s) => sum + screenPriceTotal(s), 0);
  return { totalBudget, totalScreens, otsPlan, otsFact };
}
```

In `app/[locale]/dashboard/page.tsx`, replace the inline `screenPriceTotal` and inline OTS reducers with imports from `@/lib/campaign-detail`. Verify the dashboard still renders the same numbers.

- [ ] **Step 2: Create PrintKpiStrip**

```tsx
// components/print/PrintKpiStrip.tsx
interface Cell {
  label: string;
  value: string;
  unit?: string;
}
export function PrintKpiStrip({ cells }: { cells: Cell[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cells.length}, 1fr)`, gap: 6 }}>
      {cells.map(c => (
        <div key={c.label} style={{ border: '1px solid #ddd', borderRadius: 4, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#888' }}>{c.label}</div>
          <div className="pdf-mono" style={{ fontSize: 18, fontWeight: 600, color: '#111', marginTop: 4 }}>
            {c.value}
            {c.unit && <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>{c.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function fmtBig(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('ru-RU');
}
```

- [ ] **Step 3: Wire KPI strip into the print route**

In `app/[locale]/print/campaign/[id]/page.tsx`, replace the placeholder Summary section with:

```tsx
import { PrintKpiStrip, fmtBig } from '@/components/print/PrintKpiStrip';
import { totalsForCampaign } from '@/lib/campaign-detail';

// ... inside the component, after fetching `campaign`:
const totals = totalsForCampaign(campaign);
const tDash = await getTranslations({ locale, namespace: 'dashboard' });

// ... inside JSX, replace the placeholder:
<PrintSection title={tPdf('section.summary')}>
  <PrintKpiStrip cells={[
    { label: tDash('kpiTotalBudget'),  value: fmtBig(totals.totalBudget),  unit: 'UZS' },
    { label: tDash('kpiTotalScreens'), value: totals.totalScreens.toLocaleString('ru-RU'), unit: tDash('kpiScreensUnit') },
    { label: tDash('kpiTotalOts'),     value: fmtBig(totals.otsPlan),      unit: tDash('kpiOtsUnit') },
    { label: 'OTS Fact',               value: fmtBig(totals.otsFact),      unit: tDash('kpiOtsUnit') },
  ]} />
</PrintSection>
```

- [ ] **Step 4: Smoke test**

Visit `/ru/print/campaign/<id>` in dev mode. KPI strip should show 4 cards with correct numbers.

- [ ] **Step 5: Commit**

```bash
git add lib/campaign-detail.ts app/\[locale\]/dashboard/page.tsx components/print/PrintKpiStrip.tsx "app/[locale]/print/campaign/[id]/page.tsx"
git commit -m "feat(pdf): summary KPI strip in print route"
```

---

### Task 14: Port Efficiency strip + Reach card

**Files:**
- Create: `components/print/PrintEfficiency.tsx`
- Create: `components/print/PrintReach.tsx`
- Modify: `app/[locale]/print/campaign/[id]/page.tsx`

The dashboard's `EfficiencyStrip` and `ReachCard` are visual-heavy interactive components. The print versions are pared-down: static SVG bars + tables.

- [ ] **Step 1: Create PrintEfficiency**

```tsx
// components/print/PrintEfficiency.tsx
interface Props {
  otsPlan: number;
  otsFact: number;
  label: { plan: string; fact: string; completion: string };
}

export function PrintEfficiency({ otsPlan, otsFact, label }: Props) {
  const pct = otsPlan > 0 ? Math.min(100, Math.round((otsFact / otsPlan) * 100)) : 0;
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 12, background: '#fafafa' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: '#666' }}>{label.plan}: <span className="pdf-mono">{otsPlan.toLocaleString('ru-RU')}</span></span>
        <span style={{ fontSize: 10, color: '#666' }}>{label.fact}: <span className="pdf-mono">{otsFact.toLocaleString('ru-RU')}</span></span>
      </div>
      <div style={{ height: 14, background: '#eee', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#10B981' : '#FF6B2C' }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: '#666' }}>{label.completion}: <span className="pdf-mono">{pct}%</span></div>
    </div>
  );
}
```

- [ ] **Step 2: Create PrintReach**

```tsx
// components/print/PrintReach.tsx
interface ReachRow { n: number; plan: number | null; fact: number | null; }
interface Props { entries: ReachRow[]; planLabel: string; factLabel: string; }

export function PrintReach({ entries, planLabel, factLabel }: Props) {
  if (entries.length === 0) return null;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
      <thead>
        <tr>
          <th style={cell('left')}>Охват</th>
          <th style={cell('right')}>{planLabel}</th>
          <th style={cell('right')}>{factLabel}</th>
          <th style={cell('right')}>%</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(e => (
          <tr key={e.n}>
            <td style={cell('left')}>{e.n}+</td>
            <td style={cell('right')} className="pdf-mono">{e.plan?.toFixed(1) ?? '—'}</td>
            <td style={cell('right')} className="pdf-mono">{e.fact?.toFixed(1) ?? '—'}</td>
            <td style={cell('right')} className="pdf-mono">{e.plan && e.fact ? Math.round((e.fact / e.plan) * 100) + '%' : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function cell(align: 'left' | 'right'): React.CSSProperties {
  return { textAlign: align, padding: '4px 6px', borderBottom: '1px solid #eee', fontWeight: 600 };
}
```

- [ ] **Step 3: Wire into print route**

In `app/[locale]/print/campaign/[id]/page.tsx`, add after the Summary section:

```tsx
<PrintSection title={tPdf('section.efficiency')}>
  <PrintEfficiency
    otsPlan={totals.otsPlan}
    otsFact={totals.otsFact}
    label={{ plan: tDash('otsPlan'), fact: tDash('otsFact'), completion: tDash('completion') ?? 'Completion' }}
  />
  <div style={{ height: 10 }} />
  <PrintReach
    entries={campaign.reachEntries.filter(e => e.pinned).map(e => ({ n: e.n, plan: e.plan, fact: e.fact }))}
    planLabel={tDash('otsPlan')}
    factLabel={tDash('otsFact')}
  />
</PrintSection>
```

- [ ] **Step 4: Smoke test**

Visit print route. Efficiency bar + reach table render correctly.

- [ ] **Step 5: Commit**

```bash
git add components/print/PrintEfficiency.tsx components/print/PrintReach.tsx "app/[locale]/print/campaign/[id]/page.tsx"
git commit -m "feat(pdf): efficiency strip + reach table"
```

---

### Task 15: Port Monthly Plan/Fact + Plan/Fact breakdown

**Files:**
- Create: `components/print/PrintMonthlyChart.tsx`
- Create: `components/print/PrintPlanFactBars.tsx`
- Modify: `app/[locale]/print/campaign/[id]/page.tsx`

These reuse Recharts but inside fixed-width wrappers (no `ResponsiveContainer` — Puppeteer's headless layout doesn't always trigger ResizeObserver correctly).

- [ ] **Step 1: Create PrintMonthlyChart (Recharts inside fixed div)**

```tsx
// components/print/PrintMonthlyChart.tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList } from 'recharts';

interface Row { label: string; plan: number; fact: number; }

export function PrintMonthlyChart({ rows, planLabel, factLabel }: { rows: Row[]; planLabel: string; factLabel: string; }) {
  return (
    <div style={{ width: 540, height: 220 }}>
      <BarChart width={540} height={220} data={rows} margin={{ top: 16, right: 12, bottom: 12, left: 12 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="#eee" />
        <XAxis dataKey="label" stroke="#888" fontSize={10} />
        <YAxis stroke="#888" fontSize={10} />
        <Bar dataKey="plan" fill="#3B82F6" name={planLabel} />
        <Bar dataKey="fact" fill="#FF6B2C" name={factLabel} />
      </BarChart>
    </div>
  );
}
```

- [ ] **Step 2: Create PrintPlanFactBars (similar)**

```tsx
// components/print/PrintPlanFactBars.tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Row { name: string; plan: number; fact: number; }

export function PrintPlanFactBars({ rows, planLabel, factLabel }: { rows: Row[]; planLabel: string; factLabel: string; }) {
  return (
    <div style={{ width: 540, height: 200 }}>
      <BarChart width={540} height={200} data={rows} margin={{ top: 16, right: 12, bottom: 12, left: 12 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="#eee" />
        <XAxis dataKey="name" stroke="#888" fontSize={10} />
        <YAxis stroke="#888" fontSize={10} />
        <Bar dataKey="plan" fill="#3B82F6" name={planLabel} />
        <Bar dataKey="fact" fill="#FF6B2C" name={factLabel} />
      </BarChart>
    </div>
  );
}
```

- [ ] **Step 3: Build the row data + wire both into the page**

Extract `buildMonthlyRows(campaign)` and `buildPlanFactByType(campaign)` from the existing aggregation in `dashboard/page.tsx` into `lib/campaign-detail.ts` (export them). Reuse from both consumers.

In the print page, after the Efficiency section:

```tsx
const monthly = buildMonthlyRows(campaign);
const planFactByType = buildPlanFactByType(campaign);

<PrintSection title={tPdf('section.monthly')}>
  <PrintMonthlyChart rows={monthly} planLabel={tDash('otsPlan')} factLabel={tDash('otsFact')} />
</PrintSection>

<PrintSection title={tPdf('section.breakdown')}>
  <PrintPlanFactBars rows={planFactByType} planLabel={tDash('otsPlan')} factLabel={tDash('otsFact')} />
</PrintSection>
```

- [ ] **Step 4: Smoke test**

Charts render in dev. Numbers should match the dashboard for the same campaign.

- [ ] **Step 5: Commit**

```bash
git add components/print/ lib/campaign-detail.ts app/\[locale\]/dashboard/page.tsx "app/[locale]/print/campaign/[id]/page.tsx"
git commit -m "feat(pdf): monthly + plan/fact breakdown charts"
```

---

### Task 16: Port City breakdown + Type breakdown + Top screens bar

**Files:**
- Create: `components/print/PrintCityBars.tsx`
- Create: `components/print/PrintTypeDonut.tsx`
- Create: `components/print/PrintTopScreens.tsx`
- Modify: `app/[locale]/print/campaign/[id]/page.tsx`

- [ ] **Step 1: Create PrintCityBars**

```tsx
// components/print/PrintCityBars.tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Row { city: string; screens: number; ots: number; }

export function PrintCityBars({ rows, label }: { rows: Row[]; label: string }) {
  return (
    <div style={{ width: 260, height: 180 }}>
      <BarChart width={260} height={180} data={rows} margin={{ top: 10, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="#eee" />
        <XAxis dataKey="city" stroke="#888" fontSize={9} />
        <YAxis stroke="#888" fontSize={9} />
        <Bar dataKey="ots" fill="#3B82F6" name={label} />
      </BarChart>
    </div>
  );
}
```

- [ ] **Step 2: Create PrintTypeDonut**

```tsx
// components/print/PrintTypeDonut.tsx
'use client';
import { PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#FF6B2C', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899'];

interface Slice { name: string; value: number; }

export function PrintTypeDonut({ slices }: { slices: Slice[] }) {
  return (
    <div style={{ width: 260, height: 180 }}>
      <PieChart width={260} height={180}>
        <Pie data={slices} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" stroke="#fff" strokeWidth={1}>
          {slices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={8} wrapperStyle={{ fontSize: 9 }} />
      </PieChart>
    </div>
  );
}
```

- [ ] **Step 3: Create PrintTopScreens**

```tsx
// components/print/PrintTopScreens.tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Row { address: string; ots: number; }

export function PrintTopScreens({ rows, label }: { rows: Row[]; label: string }) {
  return (
    <div style={{ width: 540, height: 240 }}>
      <BarChart width={540} height={240} data={rows} layout="vertical" margin={{ top: 8, right: 12, bottom: 8, left: 100 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="#eee" />
        <XAxis type="number" stroke="#888" fontSize={9} />
        <YAxis type="category" dataKey="address" stroke="#888" fontSize={9} width={100} />
        <Bar dataKey="ots" fill="#FF6B2C" name={label} />
      </BarChart>
    </div>
  );
}
```

- [ ] **Step 4: Build row helpers + wire**

In `lib/campaign-detail.ts`, export `buildCityRows`, `buildTypeSlices`, `buildTopScreens(campaign, limit = 10)`. (Extract from `dashboard/page.tsx`.)

In the print page, append two sections:

```tsx
<PrintSection title={tPdf('section.breakdown')}>
  <div style={{ display: 'flex', gap: 16 }}>
    <PrintCityBars rows={buildCityRows(campaign)} label={tDash('cityBreakdown')} />
    <PrintTypeDonut slices={buildTypeSlices(campaign)} />
  </div>
</PrintSection>

<PrintSection title={tPdf('section.topScreens')}>
  <PrintTopScreens rows={buildTopScreens(campaign, 10)} label={tDash('otsPlan')} />
</PrintSection>
```

- [ ] **Step 5: Smoke test**

All three charts render in dev. Page-breaks insert cleanly (no chart split across pages).

- [ ] **Step 6: Commit**

```bash
git add components/print/ lib/campaign-detail.ts "app/[locale]/print/campaign/[id]/page.tsx"
git commit -m "feat(pdf): city + type + top-screens charts"
```

---

### Task 17: Port Creatives grid

**Files:**
- Create: `components/print/PrintCreatives.tsx`
- Modify: `app/[locale]/print/campaign/[id]/page.tsx`

- [ ] **Step 1: Create PrintCreatives**

```tsx
// components/print/PrintCreatives.tsx
interface Creative {
  id: string;
  name: string;
  kind: string;        // 'VIDEO' | 'IMAGE' (etc.)
  thumbnailUrl: string | null;
  url: string;
}

export function PrintCreatives({ creatives, openLabel }: { creatives: Creative[]; openLabel: string }) {
  if (creatives.length === 0) {
    return <p style={{ fontSize: 10, color: '#999' }}>—</p>;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {creatives.map(c => (
        <div key={c.id} style={{ border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden' }}>
          {c.thumbnailUrl ? (
            <img src={c.thumbnailUrl} alt={c.name} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: 90, background: '#f3f3f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#888' }}>
              {c.kind}
            </div>
          )}
          <div style={{ padding: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
            <a href={c.url} style={{ fontSize: 8, color: '#FF6B2C', textDecoration: 'none' }}>{openLabel} →</a>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Fetch creatives in the print page**

Already fetched in dashboard/page.tsx via:

```ts
const creativeRows = await prisma.creative.findMany({
  where: { campaignId: selectedId },
  orderBy: { createdAt: 'asc' },
  select: { id: true, name: true, fileKey: true, thumbnailKey: true, mimeType: true, kind: true },
});
const creatives = await Promise.all(creativeRows.map(async c => ({
  id: c.id,
  name: c.name,
  kind: c.kind,
  url: await getFileUrl(c.fileKey),
  thumbnailUrl: c.thumbnailKey ? await getFileUrl(c.thumbnailKey) : null,
})));
```

Copy this block (or extract into `lib/campaign-detail.ts` as `loadCreatives(campaignId)`) and call it in the print route.

- [ ] **Step 3: Wire into print route**

```tsx
const creatives = await loadCreatives(campaign.id);

<PrintSection title={tPdf('section.creatives')}>
  <PrintCreatives creatives={creatives} openLabel={tPdf('creativePlay')} />
</PrintSection>
```

- [ ] **Step 4: Smoke test**

Creatives grid renders thumbs. Each has a clickable "Open" link in the PDF.

- [ ] **Step 5: Commit**

```bash
git add components/print/PrintCreatives.tsx lib/campaign-detail.ts "app/[locale]/print/campaign/[id]/page.tsx"
git commit -m "feat(pdf): creatives grid with thumbs + playback links"
```

---

### Task 18: Port full Screens list (no pagination)

**Files:**
- Create: `components/print/PrintScreensTable.tsx`
- Modify: `app/[locale]/print/campaign/[id]/page.tsx`

- [ ] **Step 1: Create PrintScreensTable**

```tsx
// components/print/PrintScreensTable.tsx
import type { DashboardCampaign } from '@/lib/campaign-detail';

interface Props {
  campaign: DashboardCampaign;
  labels: {
    rowNum: string;
    type: string;
    city: string;
    address: string;
    otsPlan: string;
    otsFact: string;
    size: string;
    impPerDay: string;
  };
}

function fmtNum(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n.toLocaleString('ru-RU');
}

export function PrintScreensTable({ campaign, labels }: Props) {
  const rows = campaign.screens.map((s, i) => {
    const otsPlan = s.metrics.reduce((m, x) => m + (x.otsPlan ?? 0), 0);
    const otsFact = s.metrics.reduce((m, x) => m + (x.otsFact ?? 0), 0);
    const size = s.metrics.find(m => m.size)?.size ?? '—';
    const impPerDay = s.metrics.find(m => m.impressionsPerDay)?.impressionsPerDay ?? null;
    return {
      n: i + 1,
      type: s.screenType.code,
      city: s.city.trim(),
      address: s.address,
      otsPlan, otsFact, size, impPerDay,
    };
  });

  return (
    <table className="pdf-screens-table">
      <thead>
        <tr>
          <th style={{ width: 20 }}>#</th>
          <th style={{ width: 50 }}>{labels.type}</th>
          <th style={{ width: 70 }}>{labels.city}</th>
          <th>{labels.address}</th>
          <th className="num" style={{ width: 60 }}>{labels.otsPlan}</th>
          <th className="num" style={{ width: 60 }}>{labels.otsFact}</th>
          <th style={{ width: 50 }}>{labels.size}</th>
          <th className="num" style={{ width: 50 }}>{labels.impPerDay}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.n}>
            <td>{r.n}</td>
            <td>{r.type}</td>
            <td>{r.city}</td>
            <td>{r.address}</td>
            <td className="num">{fmtNum(r.otsPlan)}</td>
            <td className="num">{fmtNum(r.otsFact)}</td>
            <td>{r.size}</td>
            <td className="num">{r.impPerDay != null ? r.impPerDay.toLocaleString('ru-RU') : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Wire into print route**

```tsx
<PrintSection title={tPdf('section.screens')}>
  <PrintScreensTable
    campaign={campaign}
    labels={{
      rowNum: '#',
      type: tDash('colType'),
      city: tDash('colCity'),
      address: tDash('colAddress'),
      otsPlan: tDash('otsPlan'),
      otsFact: tDash('otsFact'),
      size: tDash('colSize'),
      impPerDay: tDash('colImpDay'),
    }}
  />
</PrintSection>
```

(Translation keys above should match what exists; if some don't, add to the `dashboard` namespace.)

- [ ] **Step 3: Smoke test with a 100+ surface campaign**

Verify the table flows across multiple pages cleanly (rows don't split mid-row, header doesn't repeat — that's a known PDF limitation we accept).

- [ ] **Step 4: Commit**

```bash
git add components/print/PrintScreensTable.tsx "app/[locale]/print/campaign/[id]/page.tsx"
git commit -m "feat(pdf): full screens table without pagination"
```

---

## Phase 5 — Wire the button

### Task 19: Export-to-PDF button

**Files:**
- Create: `components/dashboard/ExportToPdfButton.tsx`
- Modify: `app/[locale]/dashboard/dashboard-client.tsx`

- [ ] **Step 1: Create the button component**

```tsx
// components/dashboard/ExportToPdfButton.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileDown, Loader2 } from 'lucide-react';

export function ExportToPdfButton({ campaignId }: { campaignId: string }) {
  const t = useTranslations('pdf');
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/pdf`, { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === 'pdf_render_timeout') alert(t('exportTimeout'));
        else alert(t('exportError'));
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const filename = cd.match(/filename="([^"]+)"/)?.[1] ?? `campaign-${campaignId}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert(t('exportError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-[13px] text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
    >
      {loading
        ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
        : <FileDown size={14} strokeWidth={1.5} />}
      {loading ? t('exporting') : t('exportButton')}
    </button>
  );
}
```

- [ ] **Step 2: Add the button to dashboard-client**

In `app/[locale]/dashboard/dashboard-client.tsx`, find the header bar (the row with the campaign selector). Add `<ExportToPdfButton campaignId={campaign.id} />` next to the selector.

```tsx
import { ExportToPdfButton } from '@/components/dashboard/ExportToPdfButton';

// ... inside the header bar:
<div className="flex items-center gap-2">
  <CampaignSelector ... />
  <ExportToPdfButton campaignId={campaign.id} />
</div>
```

(Exact placement depends on existing layout — match the visual style of nearby buttons.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

Expected: zero errors.

- [ ] **Step 4: Smoke test in browser**

Run dev server, visit a campaign, click "Export to PDF". File downloads with correct filename. Open it; cover + sections + screens table all present.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/ExportToPdfButton.tsx app/\[locale\]/dashboard/dashboard-client.tsx
git commit -m "feat(pdf): Export to PDF button on dashboard"
```

---

## Phase 6 — QA

### Task 20: Manual QA matrix

No code changes. Run through the matrix below in a built image (or against staging).

- [ ] **Step 1: Build the prod image and run it**

```bash
docker build -t ooh-test .
docker compose -f docker-compose.prod.yml up -d
```

- [ ] **Step 2: Run the matrix**

For each campaign, click Export and verify the PDF.

| Campaign profile | Locale | Expected |
|---|---|---|
| 1 surface, 1 period | ru | PDF has 4-5 pages, all sections rendered, screens table has 1 row |
| ~50 surfaces, 2 periods | ru | PDF ~8 pages, KPI strip + charts populated, screens table 1-2 pages |
| ~200 surfaces, 3 periods | ru | PDF ~12 pages, charts populated, screens table 4-5 pages, all in <15 s |
| ~50 surfaces | en | Locale strings everywhere correct, status pill in English |
| ~50 surfaces | uz | Locale strings correct |
| Campaign with no creatives | ru | Creatives section renders "—" placeholder |
| DRAFT campaign | ru | Status pill shows "DRAFT" (or hidden by section gating — verify) |
| Client user export | ru | Returns own campaign's PDF; returns 404 for another client's campaign |
| Admin user export | ru | Can export any campaign |

- [ ] **Step 3: File any bugs found**

Open issues or commits as needed; document deviations in the spec file if behaviour shifted.

- [ ] **Step 4: Commit any QA-driven fixes; tag a release**

When the matrix passes:

```bash
git log --oneline main..  # confirm what's about to ship
git checkout release
git merge --ff-only main
git push origin release
```

CI builds the GHCR image and prod deploy follows.

---

## Self-review notes

- **Spec coverage:** all 6 sections (header, KPI, efficiency+reach, charts, creatives, screens) have dedicated tasks (13, 14, 15, 16, 17, 18). Cover handled in Task 9, button in Task 19, Docker + Chromium in Task 2, auth model in Tasks 5 + 11, filename in Task 4, translations in Task 6.
- **Open question on shared aggregators:** the plan extracts `pickLatest`, `screenPriceTotal`, `totalsForCampaign`, `buildMonthlyRows`, etc., into `lib/campaign-detail.ts` as each section is ported. If during execution you find the existing dashboard code has tangled aggregation, extract MORE aggressively in Task 13 (one consolidation pass) rather than spreading it across tasks.
- **No placeholders:** every code step has full code. The only intentionally-deferred line is the `dashboard/page.tsx` button placement (Task 19 Step 2) which references "match the visual style of nearby buttons" — this is unavoidable without sed-precise line numbers because that file has been edited multiple times recently.
- **Type consistency:** `DashboardCampaign` is exported from `lib/campaign-detail.ts` (Task 3) and used in `PrintScreensTable` (Task 18). Other props use plain primitive shapes.
