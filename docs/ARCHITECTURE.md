# OOH Dashboard — Architecture Specification

> **Project:** Ledokol Group OOH Advertising Dashboard
> **Version:** 2.0
> **Last updated:** April 2026
> **Reader:** Claude Code / development agent

This document is the authoritative specification for the OOH Dashboard platform. Read it in full before making implementation decisions. Every section has been validated against real data (231 screens across 7 XLSX sheets, 182 Yandex Maps pins with 96% auto-match rate).

---

## 1. What We're Building

A two-sided web platform for Ledokol Group — an outdoor advertising (OOH) operator in Uzbekistan managing LED screens, static billboards, bus stops, airport placements, and transit ads across 10+ cities.

### Admin side (Ledokol staff)
- Mini-CRM: manage client accounts, create campaigns
- Upload XLSX media plans (single source of truth for data entry)
- No manual CRUD for screens, operators, or pricing — all derived from XLSX

### Client side (Advertisers logging in)
- Read-only dashboards showing campaign analytics
- Interactive map with screen locations
- Filtered to only their own campaigns
- Multi-language (RU default, plus EN, UZ, TR)

---

## 2. Core Principle: Spreadsheet as Single Entry Point

**Critical:** Do NOT build admin forms for screens, operators, or pricing. The Ledokol team already creates XLSX media plans for every campaign — this workflow will not change.

The system works like this:
1. Admin creates a client + campaign (minimal form: name, client, period)
2. Admin uploads XLSX → system parses → structured data goes to DB
3. Dashboards query the DB (never the raw file)

When operator APIs come online later, they become a secondary data source that writes to the same DB tables with `source: 'api'` instead of `source: 'xlsx'`.

---

## 3. Data Sources

### 3.1 XLSX Media Plan

A typical campaign XLSX has 7 sheets:

| Sheet | Purpose | Key Columns |
|-------|---------|-------------|
| `Total` | Summary + Yandex Maps URL | Budget totals, Yandex Constructor link (cell G4) |
| `LED Ташкент` | LED screens in Tashkent | Type, city, address, size, resolution, price, OTS, rating, universe, photo |
| `LED Регионы` | LED screens in other cities | Same as above + operator column |
| `LED Остановки` | LED bus stops | Same core fields, stop-specific metrics |
| `Статика Таш + Регионы` | Static billboards/prismatrons | City, address, size, price, print cost, image swap count |
| `Аэропорт` | Airport LED screens | Terminal location, screen size |
| `Автобусы` | Bus wraps | Route info, production cost |

### 3.2 Hyperlinks Inside Cells

- **Photo URLs** — The "Фото конструкции" column (column B in most sheets) has text "Фото" but a Google Drive URL as the cell hyperlink target. Must be extracted via hyperlink API, not cell value.
- **Yandex Maps URL** — Cell G4 on the `Total` sheet contains a Yandex Maps Constructor URL with all screen pins.

### 3.3 Yandex Maps Coordinates

Coordinates are NOT in the XLSX. They come from a hand-crafted Yandex Maps Constructor map referenced by URL in cell G4 of the `Total` sheet.

Example URL format:
```
https://yandex.uz/maps/10335/tashkent/?ll=69.280761%2C41.308950&mode=usermaps&source=constructorLink&um=constructor%3A5e2a584d1791b34631c6666a753435b6a05652157f1241463242030e8249cf9c&z=12.52
```

The constructor ID is after `um=constructor%3A` (URL-decoded to `um=constructor:`).

Fetch GeoJSON via:
```
https://api-maps.yandex.ru/services/constructor/1.0/js/?um=constructor:{ID}&lang=ru_RU
```

Pins contain `description` (city) and `name` (address) fields that correspond to XLSX address rows.

### 3.4 Address Matching

Yandex pin labels and XLSX address cells come from the same source but contain minor inconsistencies (typos, punctuation, word order). Use fuzzy matching:

- Normalize both strings: lowercase, strip punctuation, remove common words (`ориентир`, `ор-р`, `ул.`, `пр.`)
- Extract keyword sets, compute overlap ratio
- Threshold ~0.35 for a match
- Tested on real data: **174/182 pins matched automatically (96%)**

Unmatched pins should be logged for manual review rather than silently dropped.

---

## 4. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | **Next.js 14+ (App Router)** | SSR for dashboard performance, API routes eliminate separate backend, clean role-based layouts |
| Language | **TypeScript** | Type safety critical for complex data transformations |
| Database | **PostgreSQL** | Relational model fits perfectly (clients → campaigns → screens) |
| ORM | **Prisma** | Type-safe queries, auto-migrations, clean schema |
| Auth | **NextAuth.js v5** | Credentials-based, role-aware middleware |
| Maps | **Mapbox GL JS** | Same library as Geomotive (reference product), supports clustering + heatmaps |
| Charts | **Recharts + Tremor** | Recharts for custom viz, Tremor for KPI cards |
| XLSX parsing | **SheetJS** (primary) + **openpyxl** as Python microservice fallback | SheetJS for most parsing, Python for deep hyperlink extraction if needed |
| Validation | **Zod** | Schema validation for parsed XLSX data before DB write |
| Fuzzy matching | **fuse.js** | Match Yandex pins to XLSX addresses |
| i18n | **next-intl** | 4 languages: RU, EN, UZ, TR |
| File storage | **MinIO** (S3-compatible) | Self-hosted, stores XLSX originals and any cached images |
| Deployment | **Docker + Docker Compose** | Self-hosted on Uzbekistan VPS |
| Reverse proxy | **Nginx** | SSL termination, static file serving |
| CI/CD | **GitHub Actions** | Auto-deploy on push to main |

### What we explicitly chose NOT to use
- **Separate backend (Express/FastAPI)** — Next.js API routes are sufficient at this scale
- **MongoDB** — data is relational, not document-oriented
- **Cloud-hosted (Vercel/AWS)** — data sovereignty concerns in UZ market
- **Geocoding API (Google/Mapbox)** — Yandex Maps Constructor already provides coordinates
- **Real-time features (WebSockets)** — dashboards refresh on filter change is enough

---

## 5. Data Model

### 5.1 Prisma Schema

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserRole {
  ADMIN
  CLIENT
}

enum Language {
  RU
  EN
  UZ
  TR
}

enum ScreenType {
  LED
  STATIC
  STOP
  AIRPORT
  BUS
}

enum CampaignStatus {
  ACTIVE
  PAUSED
  COMPLETED
  DRAFT
}

enum DataSource {
  XLSX
  API
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  role          UserRole
  language      Language  @default(RU)
  clientId      String?
  client        Client?   @relation(fields: [clientId], references: [id])
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Client {
  id              String     @id @default(uuid())
  name            String
  contactPerson   String?
  users           User[]
  campaigns       Campaign[]
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}

model Campaign {
  id              String          @id @default(uuid())
  clientId        String
  client          Client          @relation(fields: [clientId], references: [id])
  name            String
  project         String?
  periodStart     DateTime
  periodEnd       DateTime
  status          CampaignStatus  @default(DRAFT)
  sourceFileUrl   String?         // MinIO URL for uploaded XLSX
  yandexMapUrl    String?         // Original Yandex Maps Constructor URL
  totalBudgetUzs  BigInt?
  totalBudgetRub  BigInt?
  screens         Screen[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([clientId])
  @@index([status])
}

model Screen {
  id            String         @id @default(uuid())
  campaignId    String
  campaign      Campaign       @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  externalId    String?        // id from XLSX where available
  type          ScreenType
  city          String
  address       String
  lat           Float?
  lng           Float?
  size          String?        // e.g. "6x3"
  resolution    String?        // e.g. "1920x1080"
  photoUrl      String?        // Google Drive URL
  pricing       ScreenPricing?
  metrics       ScreenMetrics?
  impressions   Impression[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@index([campaignId])
  @@index([city])
  @@index([type])
}

model ScreenPricing {
  id                String  @id @default(uuid())
  screenId          String  @unique
  screen            Screen  @relation(fields: [screenId], references: [id], onDelete: Cascade)
  priceUnit         BigInt?
  priceDiscounted   BigInt?
  priceTotal        BigInt?
  priceRub          BigInt?
  commissionPct     Decimal?
  productionCost    BigInt?
}

model ScreenMetrics {
  id          String      @id @default(uuid())
  screenId    String      @unique
  screen      Screen      @relation(fields: [screenId], references: [id], onDelete: Cascade)
  ots         Int?        // Opportunity To See
  rating      Decimal?
  universe    Int?
  source      DataSource  @default(XLSX)
}

model Impression {
  id          String      @id @default(uuid())
  screenId    String
  screen      Screen      @relation(fields: [screenId], references: [id], onDelete: Cascade)
  date        DateTime
  count       Int
  source      DataSource  @default(API)  // impressions only come from API post-MVP

  @@unique([screenId, date])
  @@index([date])
}
```

---

## 6. XLSX Parser Specification

This is the most complex subsystem. Build it in `/lib/parser/`.

### 6.1 Entry Point

```typescript
// lib/parser/index.ts
interface ParseResult {
  campaign: CampaignData;
  screens: ScreenData[];
  unmatchedPins: YandexPin[];
  errors: ParseError[];
  warnings: ParseWarning[];
}

async function parseMediaPlan(file: Buffer): Promise<ParseResult>
```

### 6.2 Parser Stages

```
Stage 1: Load workbook (SheetJS)
  ↓
Stage 2: Detect sheet types by name
  ↓
Stage 3: Per-sheet row extraction + hyperlink extraction
  ↓
Stage 4: Fetch Yandex Constructor GeoJSON
  ↓
Stage 5: Fuzzy-match pins to rows → assign lat/lng
  ↓
Stage 6: Validate with Zod schemas
  ↓
Stage 7: Return structured result
```

### 6.3 Sheet Detection

Match sheet names case-insensitively against these patterns:

| Pattern (regex) | Sheet Type |
|-----------------|------------|
| `/led.*ташкент/i` | `LED_TASHKENT` |
| `/led.*регион/i` | `LED_REGIONS` |
| `/led.*остановк/i` | `LED_STOPS` |
| `/статик/i` | `STATIC` |
| `/аэропорт/i` | `AIRPORT` |
| `/автобус/i` | `BUSES` |
| `/total/i` | `TOTAL` |

### 6.4 Column Mapping

Columns shift between sheet types. Detect by header row (usually row 7) rather than by fixed positions. Build a mapping layer:

```typescript
const COLUMN_ALIASES: Record<string, string[]> = {
  type: ['Тип Внешней Рекламы'],
  photo: ['Фото конструкции', 'Фото'],
  city: ['Город'],
  address: ['Адрес расположения', 'Адрес'],
  size: ['Размер конструкции'],
  resolution: ['Разрешение'],
  priceUnit: ['Стоимость за 1 единицу (без НДС)', 'Стоимость за 1 единицу (без АК и НДС)'],
  priceDiscounted: ['Цена с учетом скидки'],
  priceTotal: ['Общая сумма (без АК и НДС)', 'Общая сумма'],
  ots: ['ots'],
  rating: ['rating'],
  universe: ['universe'],
  externalId: ['id', 'ID'],
  // ... etc
};
```

### 6.5 Hyperlink Extraction

SheetJS exposes hyperlinks via `cell.l.Target`. For photo column, extract both display text AND hyperlink target:

```typescript
const photoCell = sheet['B' + rowIndex];
const photoUrl = photoCell?.l?.Target; // Google Drive URL
```

For the Yandex Maps URL on `Total` sheet, cell G4 may contain the URL as text or as a hyperlink. Check both `cell.v` (value) and `cell.l.Target` (link).

### 6.6 Google Drive URL Normalization

Raw share URLs (`https://drive.google.com/file/d/{ID}/view?usp=share_link`) need conversion for thumbnail display:

```typescript
// Extract file ID from share URL
const match = url.match(/\/file\/d\/([^/]+)/);
const fileId = match?.[1];

// Direct thumbnail URL
const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
```

### 6.7 Yandex GeoJSON Fetch

```typescript
async function fetchYandexPins(mapUrl: string): Promise<YandexPin[]> {
  const constructorId = extractConstructorId(mapUrl);
  const apiUrl = `https://api-maps.yandex.ru/services/constructor/1.0/js/?um=constructor:${constructorId}&lang=ru_RU`;

  // The response is JS that contains a JSON object. Extract it.
  const jsText = await fetch(apiUrl).then(r => r.text());
  const geoJson = extractGeoJsonFromJs(jsText);

  return geoJson.features.map(f => ({
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    city: f.properties.description,
    label: f.properties.name,
    color: f.properties['marker-color'],
  }));
}
```

### 6.8 Fuzzy Matching Algorithm

```typescript
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,;:!?«»""'()\-–—/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(ориентир|ор-р|ор р|ул|пр|проспект|улица|перекр[её]сток|пересечение)\b/g, '')
    .trim();
}

function extractKeywords(s: string): Set<string> {
  return new Set(normalize(s).split(' ').filter(w => w.length > 2));
}

function matchScore(pinLabel: string, rowAddress: string): number {
  const pinKw = extractKeywords(pinLabel);
  const rowKw = extractKeywords(rowAddress);
  if (!pinKw.size || !rowKw.size) return 0;
  const overlap = [...pinKw].filter(w => rowKw.has(w)).length;
  return overlap / Math.max(pinKw.size, rowKw.size);
}

// Threshold: 0.35
// Greedy assignment: each pin matches best row; each row used at most once
```

---

## 7. Routing Structure

```
/                          → Redirect to /login or dashboard based on role
/login                     → Login page
/[locale]/admin            → Admin home (client list)
/[locale]/admin/clients    → Client CRUD
/[locale]/admin/clients/[id]
/[locale]/admin/campaigns  → Campaign list across all clients
/[locale]/admin/campaigns/[id]
/[locale]/admin/campaigns/[id]/upload  → XLSX upload UI
/[locale]/dashboard        → Client-side: their campaign list
/[locale]/dashboard/[campaignId]  → Client-side: campaign dashboard
```

Middleware (`middleware.ts`) checks role at every `/admin/*` and redirects to `/dashboard` if user is a client.

---

## 8. Client Dashboard Widgets

Built in Phase 3–4. Reference: Geomotive screenshots.

| Widget | Data source | Notes |
|--------|-------------|-------|
| Campaign selector | `campaigns` WHERE `clientId = user.clientId` | Dropdown |
| Date range filter | — | Applies to impressions (post-MVP) |
| Plan completion bar | Calculated from `screens.ots` sum vs. target | Show absolute + percentage |
| Impressions by day | `impressions` grouped by date | **Post-MVP** (requires API) |
| Impressions by type | `screens` grouped by `type`, summing OTS | Donut chart — Recharts |
| Surface count | `COUNT(screens)` for campaign | Simple KPI card |
| Hourly distribution | — | **Post-MVP** (requires API) |
| Impressions by surface | `screens` sorted by OTS, top N | Horizontal bar chart |
| Map | `screens` with lat/lng | Mapbox markers, color by type, heatmap toggle |
| Screens table | `screens` | Paginated, sortable, searchable |

For MVP, widgets that depend on daily/hourly impression data should render a "Data available after operator API integration" empty state.

---

## 9. Build Phases

### Phase 1 — Foundation (~2 weeks)
- Next.js 14 scaffold with App Router
- TypeScript strict mode
- PostgreSQL + Prisma schema
- NextAuth v5 with credentials + role middleware
- i18n (next-intl) with RU default
- Docker + Docker Compose dev environment
- GitHub Actions CI (lint + typecheck + test on PR)
- Basic layout shells for admin and dashboard sides
- Health check endpoint

### Phase 2 — Admin CRM + XLSX Engine (~3 weeks)
- Client CRUD (simple forms)
- Campaign create form (name, client, period — nothing else)
- XLSX upload UI with drag-drop
- Parser (Section 6 above)
- Yandex GeoJSON fetch + fuzzy match
- Zod validation with error surfacing
- MinIO storage for XLSX originals
- Upload preview screen showing parse results before DB commit
- Unmatched pins review UI

### Phase 3 — Client Dashboard: Charts (~2–3 weeks)
- Campaign list for client
- Campaign selector + filters
- KPI cards (budget, surfaces, OTS total)
- Impressions by type (donut)
- Impressions by surface (horizontal bars)
- Empty states for post-MVP widgets
- Responsive layout

### Phase 4 — Client Dashboard: Map + Table (~2 weeks)
- Mapbox GL integration
- Screen markers color-coded by type
- Marker clustering at zoom levels
- Popup with screen details + photo thumbnail
- Heatmap layer toggle
- Screens table (paginated, sortable)
- Column filters

### Phase 5 — Polish & Launch (~1–2 weeks)
- Full i18n for all 4 languages
- Mobile responsiveness pass
- Query performance optimization (indexes, eager loading)
- Image lazy loading
- Error monitoring (Sentry)
- Admin overview page (total clients, campaigns, screens)
- UAT with real Ledokol data
- Deployment to production VPS

---

## 10. Post-MVP Backlog

Not in scope for initial launch:

- Operator API integrations (daily/hourly impressions, live spend)
- Multi-operator support (when XLSX starts listing Media Lux, Apex Media, etc.)
- Competitor analysis module
- PDF/XLSX report export
- Campaign comparison views
- Notification system (email on upload complete, etc.)
- Audit log for admin actions
- Media library (creative asset management)

---

## 11. Key Architectural Decisions

1. **Spreadsheet = data entry, DB = data serving.** Parse once, serve many times. Future API data plugs into the same tables.
2. **Yandex Maps Constructor for geocoding.** No third-party geocoding API needed. 96% auto-match rate on real data.
3. **Single operator (Ledokol) in MVP.** Schema supports multiple; UI doesn't differentiate yet.
4. **No daily impressions in MVP.** Chart components built but empty-state until API integration.
5. **Google Drive photos as-is.** Use thumbnail API endpoint, don't re-host.
6. **Self-hosted in Uzbekistan.** Data sovereignty + latency.
7. **Monorepo single Next.js app.** No microservices at this scale.

---

## 12. Non-Functional Requirements

- **Performance:** Dashboard must render in < 2s on 3G. Charts must render < 500ms after data loads.
- **Security:** HTTPS only, bcrypt password hashing, SQL injection protection via Prisma, CSRF tokens on mutations, rate limiting on login endpoint.
- **Accessibility:** WCAG 2.1 AA where reasonable. Keyboard navigation for all admin flows.
- **Browser support:** Last 2 versions of Chrome, Safari, Firefox, Edge. No IE.
- **Data integrity:** XLSX parsing is transactional — either all rows import or none. Failed parses roll back.
- **Logging:** Structured JSON logs. Separate log streams for parser errors vs. app errors.

---

## 13. File Structure Convention

```
/
├── app/
│   ├── [locale]/
│   │   ├── admin/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── clients/
│   │   │   └── campaigns/
│   │   ├── dashboard/
│   │   │   ├── layout.tsx
│   │   │   └── [campaignId]/
│   │   └── login/
│   └── api/
│       ├── auth/
│       ├── campaigns/
│       └── upload/
├── components/
│   ├── ui/              # Base components (buttons, inputs)
│   ├── charts/          # Chart components
│   ├── map/             # Mapbox components
│   └── admin/           # Admin-specific components
├── lib/
│   ├── parser/          # XLSX parsing subsystem
│   │   ├── index.ts
│   │   ├── sheets/      # Per-sheet-type extractors
│   │   ├── yandex.ts    # Yandex GeoJSON fetch
│   │   ├── matcher.ts   # Fuzzy matching
│   │   └── schemas.ts   # Zod schemas
│   ├── db.ts            # Prisma client singleton
│   ├── auth.ts          # NextAuth config
│   └── i18n.ts
├── messages/            # i18n translations
│   ├── ru.json
│   ├── en.json
│   ├── uz.json
│   └── tr.json
├── prisma/
│   └── schema.prisma
├── public/
├── docker-compose.yml
├── Dockerfile
└── middleware.ts
```

---

## 14. Reference Data

Already gathered and validated:

- **Sample XLSX:** `ЧЕРНОВИК.xlsx` — Т-банк 2026 campaign, 231 screens across 7 sheets
- **Geomotive screenshots:** 13 screenshots of the reference product UI (dashboard, map, settings, statistics, media library)
- **Yandex Maps pins:** 182 pins in constructor `5e2a584d1791b34631c6666a753435b6a05652157f1241463242030e8249cf9c`
- **Match rate tested:** 174/182 (96%) with threshold 0.35 on keyword overlap
- **Photo URLs:** Google Drive share links, one per screen row (one per row verified in LED Ташкент sheet)

---

## 15. Glossary

- **OOH** — Out-of-Home advertising (billboards, LED screens, transit)
- **DSP** — Demand-Side Platform (what Geomotive is)
- **OTS** — Opportunity To See (impression metric)
- **Поверхность / Surface** — Individual ad screen/panel
- **РК** — Рекламная Кампания (advertising campaign)
- **Показы** — Impressions (views)
- **Оператор** — Media owner who owns the physical screens
- **Медиаплан** — Media plan (the XLSX document)
- **Креатив** — Creative asset (the video/image shown on screens)