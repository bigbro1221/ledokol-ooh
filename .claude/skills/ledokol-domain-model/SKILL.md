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
- `Campaign` → many `Screen`s (cascade delete)
- `Screen` → one `ScreenPricing`, one `ScreenMetrics`, many `Impression`s

Enums: `UserRole` (ADMIN/CLIENT), `Language` (RU/EN/UZ/TR), `ScreenType` (LED/STATIC/STOP/AIRPORT/BUS), `CampaignStatus` (ACTIVE/PAUSED/COMPLETED/DRAFT), `DataSource` (XLSX/API).

## Glossary

- **OOH** — Out-of-Home advertising
- **OTS** — Opportunity To See (impression metric)
- **Поверхность / Surface** — Individual ad screen/panel
- **РК** — Рекламная Кампания (campaign)
- **Показы** — Impressions
- **Оператор** — Media owner with physical screens
- **Медиаплан** — Media plan (the XLSX)
- **Креатив** — Creative asset (video/image on screens)
