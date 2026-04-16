---
name: mapbox-ooh-screens
description: Mapbox GL JS integration for OOH screen locations — markers color-coded by type, clustering for 100+ screens, popups with screen details and photo thumbnails, heatmap toggle layer, and bounds auto-fit.
triggers:
  - Mapbox GL JS integration
  - screen markers on map
  - map clustering or heatmap
  - screen location popups
  - map bounds or viewport
  - color-coded markers by screen type
---

# Mapbox OOH Screens — Ledokol

Reference: `docs/ARCHITECTURE.md` sections 4, 8 (map widget), 9 (Phase 4).

## Color Mapping by Screen Type

| ScreenType | Color | Hex |
|-----------|-------|-----|
| LED | Blue | #3B82F6 |
| STATIC | Green | #22C55E |
| STOP | Orange | #F97316 |
| AIRPORT | Purple | #8B5CF6 |
| BUS | Red | #EF4444 |

## Marker Clustering

For 100+ screens, use Mapbox's built-in clustering:
- Cluster radius: 50px
- Show count in cluster circles
- Color clusters by dominant screen type or use neutral color
- Expand cluster on click

## Popup Template

On marker click, show popup with:
- Address (bold)
- City
- Screen type badge (colored)
- Size (e.g., "6x3")
- OTS value
- Photo thumbnail (Google Drive thumbnail URL, lazy-loaded)

## Heatmap Layer

Toggle-able heatmap layer based on OTS values:
- Weight by OTS
- Radius: 20px at zoom 10, scaling with zoom
- Color ramp: transparent → yellow → orange → red

## Bounds Auto-Fit

On campaign load, fit map bounds to all screen markers with padding. Use `map.fitBounds()` with ~50px padding.
