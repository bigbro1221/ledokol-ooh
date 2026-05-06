---
name: ledokol-domain-model
description: Ledokol Group OOH advertising domain model — campaigns, screens, operators, pricing, OTS/rating metrics, Russian/Uzbek OOH terminology. Covers business rules, Prisma schema, and data source strategy.
triggers:
  - working with campaigns or screens
  - Prisma schema or migrations
  - OOH advertising domain logic
  - pricing or metrics models
  - client-campaign-screen relationships
  - DataSource enum usage
  - any Russian OOH terminology
builds_on:
  - jeffallan/postgres-pro (DB optimization)
  - jeffallan/api-designer (endpoint design)
---

# Ledokol Domain Model — OOH Advertising

Reference: `docs/ARCHITECTURE.md` sections 2, 5, 11, 15.

## Core Business Rules

1. **Spreadsheet = data entry, DB = data serving.** Parse once, serve many. No admin forms for screens/operators/pricing.
2. **Single operator (Ledokol) in MVP.** Schema supports multi-operator; UI doesn't differentiate yet.
3. **DataSource enum**: `XLSX` for parsed data, `API` for future operator API integration. Both write to the same tables.
4. **No daily impressions in MVP.** Chart components render empty states until API integration.
5. **Google Drive photos used as-is** via thumbnail API. No re-hosting.

## Data Flow

```
Admin creates Client + Campaign (minimal form)
  → Admin uploads XLSX
    → Parser extracts structured data
      → Zod validates
        → Transactional DB write (all or nothing)
          → Dashboards query DB
```

## Prisma Schema

Full schema in `prisma/schema.prisma`. Key relationships:
- `User` → optional `Client` (CLIENT role users are linked)
- `Client` → many `Campaign`s
- `Campaign` → many `Screen`s (cascade delete), many `CampaignPeriod`s
- `Screen` → many `ScreenPricing` (per period), many `ScreenMetrics` (per period), many `Impression`s
- `Screen` → `ScreenTypeRef` via `typeId` FK

Enums: `UserRole` (ADMIN/CLIENT), `UserStatus` (INVITED/ACTIVE/DISABLED), `Language` (RU/EN/UZ), `CampaignStatus` (ACTIVE/PAUSED/COMPLETED/DRAFT), `DataSource` (XLSX/API), `MediaType` (SCREENS/OTHER_CARRIERS), `DateFormat` (5 modes).

### Screen types (reference table, NOT enum)

The old `enum ScreenType { LED STATIC STOP AIRPORT BUS }` was removed in 2026-05 and replaced by the `ScreenTypeRef` reference table. Seeded with 9 rows:

`LED`, `STATIC`, `STOP`, `AIRPORT`, `BUS`, `ROOF`, `BRANDMAUER`, `CINEMA`, `METRO`.

- `Screen.typeId` is the FK to `ScreenTypeRef.id`.
- New code reads `screen.screenType.code` (string), not `screen.type` (the old enum field is gone).
- `ScreenTypeRef.category` is `"SCREENS"` or `"OTHER_CARRIERS"` — informational only; it does not gate which `Campaign.mediaType` a screen can attach to.

### Media types

`Campaign.mediaType: SCREENS | OTHER_CARRIERS` selects the parser branch and workbook shape:
- `SCREENS` — multi-sheet workbook, one row per screen, prices in the file.
- `OTHER_CARRIERS` — single sheet `Медиаплан`, one row per `(screen × period)`. Periods auto-created from a `dd.mm.yyyy - dd.mm.yyyy` string in column F. Pricing entered in the campaign form.

The toggle is locked (server returns `409 mediaType_locked` on PUT `/api/campaigns/[id]`) once any `CampaignPeriod` exists or any of `totalBudgetUzs`, `productionCost`, `totalFinal`, `additionalAmount` is non-null.

### Currency on Campaign / CampaignPeriod

The hardcoded `totalBudgetRub BigInt?` column was removed and replaced by a generic pair:

- `additionalCurrency String?` — free-text currency code (e.g. `"RUB"`, `"USD"`).
- `additionalAmount BigInt?` — secondary-currency total.

Both `Campaign` and `CampaignPeriod` carry this pair.

## Glossary

- **OOH** — Out-of-Home advertising
- **OTS** — Opportunity To See (impression metric)
- **Поверхность / Surface** — Individual ad screen/panel
- **РК** — Рекламная Кампания (campaign)
- **Показы** — Impressions
- **Оператор** — Media owner with physical screens
- **Медиаплан** — Media plan (the XLSX)
- **Креатив** — Creative asset (video/image on screens)
