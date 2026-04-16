---
name: dashboard-widgets-ledokol
description: Build OOH dashboard charts, KPI cards, and filter-reactive components for the Ledokol client dashboard. Covers Recharts config, Tremor KPI cards, empty states for post-MVP widgets, and URL search param-based filtering.
triggers:
  - building dashboard charts or widgets
  - KPI cards for campaigns
  - Recharts or Tremor components
  - campaign filter or selector components
  - empty state for post-MVP features
  - client-side dashboard layout
builds_on:
  - anthropic-agent-skills/frontend-design (visual quality)
  - vercel-labs/react-best-practices (React patterns)
  - jeffallan/react-expert (advanced component patterns)
---

# Dashboard Widgets — Ledokol OOH

Reference: `docs/ARCHITECTURE.md` section 8.

## Widget Inventory

| Widget | Data Source | Phase |
|--------|-----------|-------|
| Campaign selector | campaigns WHERE clientId = user.clientId | 3 |
| Date range filter | — | 3 (post-MVP data) |
| Plan completion bar | screens.ots sum vs target | 3 |
| Impressions by day | impressions grouped by date | Post-MVP |
| Impressions by type | screens grouped by type, summing OTS | 3 (donut) |
| Surface count | COUNT(screens) | 3 (KPI card) |
| Hourly distribution | — | Post-MVP |
| Impressions by surface | screens sorted by OTS, top N | 3 (horizontal bar) |
| Map | screens with lat/lng | 4 |
| Screens table | screens paginated | 4 |

## Empty State Pattern

Post-MVP widgets that need API data should render:
> "Data available after operator API integration"

Use a consistent empty state component with an icon and message.

## Filter Strategy

Use URL search params for filter state (campaign ID, date range, screen type). This enables:
- Shareable filtered views
- Browser back/forward works
- Server Components can read params directly

## Chart Libraries

- **Recharts** for custom charts (donut, bar, area)
- **Tremor** for KPI cards with trend indicators
- Style to match Geomotive reference screenshots (clean, professional, data-dense)
