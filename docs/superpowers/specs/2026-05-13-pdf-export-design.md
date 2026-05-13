# PDF export — design

**Date:** 2026-05-13
**Status:** Approved (pending implementation plan)
**Author:** brainstorming session, beck + claude

## Problem

Clients ask for a takeaway document summarising a campaign — something they can email, archive, or print. Today the dashboard is web-only. We need a one-click "Export to PDF" that produces a multi-page A4 report capturing the campaign's surfaces, charts, creatives, and reach data.

## Non-goals

- Public sharing links (e.g., a tokenised "view PDF without logging in" URL). Out of scope.
- Async generation, queues, or email delivery. Sync only.
- Cached or pre-rendered PDFs (regenerate on every click).
- Per-period exports (one campaign = one PDF).
- A "Print" stylesheet that uses `window.print()` as a fallback. Single render path.
- Map rendering inside the PDF (WebGL canvas is unreliable headless; explicitly dropped).
- Editing the PDF in the browser before download.

## Trigger & UX

- Button labelled **"Export to PDF"** placed in the campaign-detail header, next to the campaign selector. Same visual treatment as other secondary buttons (`rounded-[var(--radius-md)] border border-[var(--border)]`).
- Visible to **admins and clients**. Admins can export any campaign; clients can export only campaigns belonging to their client account (same scope as dashboard read).
- Synchronous: click → button enters loading state with spinner → file downloads when ready. Hard timeout 30 s; on timeout, toast: "PDF generation took too long — please try again."
- Filename: `{client-slug}-{campaign-slug}-{YYYY-MM-DD}.pdf` (e.g. `geely-rk-geely-2-flight-2026-05-13.pdf`). Slugify via lowercase + ASCII transliteration + `-`-separated tokens.
- PDF renders in the user's current locale (ru / en / uz), inherited from the URL.

## PDF layout

A4 portrait. Margins: 16 mm top/bottom, 14 mm left/right. Cover + per-page header + per-page footer. Inner pages flow content with `page-break-inside: avoid` on each section.

### Cover (page 1)

- Top-left: Ledokol logo (`/ledokol-logo.svg`, ~36 px tall).
- Top-right: "Generated dd.mm.yyyy" (text-3, 11 px).
- Vertical centre, left-aligned:
  - Label "Client" (uppercase, text-3) → client name (sans, 22 px).
  - Campaign title (Fraunces, 36 px).
  - Period range in mono, dd.mm.yyyy — dd.mm.yyyy.
  - Status pill (`ACTIVE` / `PAUSED` / `COMPLETED` with the existing translucent colour scheme).
- Bottom band: `ledokolgroup.com` (left) and page number (right).

### Per-page header (pages 2+)

Thin top strip: `{Campaign name} · {Client name}` (left) and `{period range}` (right). 10 px text-3, divider below.

### Per-page footer (pages 2+)

`Generated dd.mm.yyyy` (left), `Page X / Y` (right). Same 10 px text-3 treatment.

### Content order (pages 2+)

1. **Summary** — 4-card KPI strip (Budget, Surfaces, OTS Plan, OTS Fact).
2. **Efficiency strip** + **Reach card** (plan/fact with completion %).
3. **Monthly Plan/Fact** bar chart.
4. **Plan/Fact breakdown** (vertical bars).
5. **City breakdown** + **Type breakdown** (impressions donut + budget by type) side-by-side.
6. **Top screens** bar (top 10 by OTS plan).
7. **Creatives grid** — thumbnails only, with playback links underneath each. No embedded video, no autoplay. If a creative has no thumbnail, render a placeholder card with file name and a link.
8. **Screens list** — full table, multi-page if needed. Columns: `#`, `Тип`, `Город`, `Адрес`, `OTS план`, `OTS факт`, `Размер`, `Выходов/день`. Drops the `Гео` and `Фото` action columns (no value in PDF). Mono numerics, 10 px font, alternating row stripes.

## Architecture

### New files

| Path | Purpose |
|------|---------|
| `app/[locale]/print/campaign/[id]/page.tsx` | Print-only server-rendered page. Same Prisma query as dashboard, different layout. Auth-checked. |
| `app/api/campaigns/[id]/pdf/route.ts` | API endpoint. Auth-checks, launches Puppeteer, returns the PDF buffer. |
| `components/print/PrintCover.tsx` | Cover-page component. |
| `components/print/PrintHeader.tsx` / `PrintFooter.tsx` | Running chrome (rendered into Puppeteer's `headerTemplate` / `footerTemplate`, not in body). |
| `components/print/PrintSection.tsx` | Section wrapper with `break-inside: avoid` and label styling. |
| `components/print/PrintScreensTable.tsx` | Full-list table, no pagination, no filters. |
| `components/print/ExportToPdfButton.tsx` | The trigger button; client component with loading state. |
| `lib/pdf/render.ts` | Puppeteer wrapper (singleton instance + cookie pass-through + render-PDF helper). |
| `lib/pdf/slug.ts` | Filename slugifier (ASCII transliteration). |
| `app/[locale]/print/print.css` | Print-only CSS (page sizing, page breaks). Imported by the print route only. |

### Touch points

- `app/[locale]/dashboard/dashboard-client.tsx`: insert `<ExportToPdfButton campaignId={...} />` into the header bar.
- `Dockerfile`: install Chromium (`apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont` on the alpine base). Set `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` (verify final path in the plan).
- `docker-compose.prod.yml`: bump app container `shm_size` to `1gb` for stable headless rendering (`--disable-dev-shm-usage` is also used as a belt-and-braces flag).

### Print route data flow

The print route does **not** introduce a new query — it imports the same `getCampaignForDashboard(id, userId)` helper that `dashboard/page.tsx` will be refactored into (a small drive-by extraction, since the current query is inlined). One query, two consumers (dashboard, print).

## Auth model

- The PDF API route runs as the requesting user (same NextAuth session check as dashboard).
- After auth passes, the API route launches Puppeteer and creates a new browser context.
- It reads the request's session cookie (`next-auth.session-token` or equivalent) and `page.setCookie()`s it into the Puppeteer context.
- Puppeteer navigates to `http://localhost:3000/{locale}/print/campaign/{id}` (in-container loopback, no public exposure).
- The print route is auth-protected like any other dashboard page — Puppeteer passes the cookie, the route accepts it, renders the data.
- The print route is **not** an `/admin/` route — clients hit it too. Same RBAC as the existing dashboard route.

This keeps user permissions intact: clients can only render PDFs for their own campaigns because the print route enforces it.

## Puppeteer setup

- **Library:** `puppeteer-core` (don't ship bundled Chromium; rely on the system binary).
- **Binary:** Alpine package `chromium` (installed to `/usr/bin/chromium-browser` in alpine; the implementation plan will verify the actual path during the Dockerfile step). Base image is already `node:20-alpine`.
- **Launch flags:** `--no-sandbox --disable-dev-shm-usage --disable-gpu --font-render-hinting=none`.
- **Singleton:** keep one browser instance warm across requests (cold start ~1 s, warm start ~50 ms). Recycle every 200 PDFs or on error.
- **Wait condition:** after `page.goto`, wait for `[data-pdf-ready="1"]` selector — the print page sets it when fonts + chart `<svg>` rendering have settled (single `useEffect` in a top-level client component, `document.fonts.ready` + 1 RAF + 1 setTimeout to give Recharts time to commit).
- **PDF options:** `{ format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '14mm', right: '14mm' }, displayHeaderFooter: true, headerTemplate, footerTemplate, printBackground: true }`.

### Header/footer templates

Puppeteer's `headerTemplate` / `footerTemplate` use a quirky isolated HTML environment — no external stylesheet, only inline styles. Pages 2+ get a thin header (campaign + period) and footer (date + page number); page 1 gets blank header/footer so the cover stands alone (`displayHeaderFooter: true` + a `@page :first` CSS rule that hides them on page 1 is unreliable; instead the templates check `pageNumber === 1` and render nothing).

## Translations

PDF strings use the existing `next-intl` namespaces:

- `dashboard` for section titles (`kpiBudget`, `monthlyPlanFact`, etc.).
- `campaignStatus` for the status pill.
- A new `pdf` namespace for PDF-only strings: `pdf.generatedOn`, `pdf.coverLabel`, `pdf.pageOf`, `pdf.creativesSection`, `pdf.screensSection`. Add entries in `messages/{ru,en,uz}.json`.

## Failure modes

- **Puppeteer fails to launch** → 500 with `{ error: 'pdf_launch_failed' }`, button shows toast "Could not start PDF generator — contact support."
- **Wait selector times out (charts didn't settle in 30 s)** → 504 with `{ error: 'pdf_render_timeout' }`, button toast "PDF took too long — please try again." Server logs the campaignId for debugging.
- **User loses session mid-render** → Puppeteer hits a redirect to /login → wait selector never appears → timeout path above.
- **Campaign has no data (no screens, no creatives, etc.)** → renders sections with their existing empty-state UI, PDF still produced.

## What's intentionally not in scope

- A "share PDF" link (e.g., MinIO-hosted public URL). Out — re-evaluate if clients request it.
- Per-period scoping inside one campaign. Out — whole-campaign only.
- Bulk export (multiple campaigns into one PDF). Out.
- Cover-page customisation per-client (custom logo, custom colours). Out — fixed Ledokol branding only.

## Open questions

None pending — all decisions are baked into the doc above. Layout was approved via wireframe; architecture, auth model, format, sync semantics, and section list are all confirmed.

## Rough implementation order

(Detailed plan to be authored by the writing-plans skill next.)

1. Extract `getCampaignForDashboard(id, userId)` from `dashboard/page.tsx` into `lib/campaign-detail.ts`. Refactor only; no behaviour change.
2. Add Chromium + Puppeteer to the Docker image. Verify a hello-world PDF renders end-to-end.
3. Build `lib/pdf/render.ts` (singleton Puppeteer, cookie pass-through, PDF helper).
4. Build the print route + minimal `PrintSection` / `PrintCover` / `PrintHeader` / `PrintFooter` components. No charts yet — just cover + headers + footers.
5. Wire `/api/campaigns/[id]/pdf` end-to-end with the skeleton route. Confirm a 2-page "Hello PDF" downloads.
6. Port sections one by one (KPI strip → efficiency/reach → monthly → breakdowns → top screens → creatives → screens table).
7. Add `[data-pdf-ready="1"]` flag once all sections render correctly.
8. Wire `ExportToPdfButton` into `dashboard-client.tsx` with loading state.
9. Translations for the new `pdf` namespace.
10. Manual QA across ru/en/uz, several campaign sizes (1 surface, 50, 200), several mediaTypes.
