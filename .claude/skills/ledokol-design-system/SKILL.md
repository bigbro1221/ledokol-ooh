# Skill: Ledokol Design System

## Trigger
Use this skill for any UI/component work on the dashboard or admin panel.

## Core Philosophy
Premium, dual-personality: sleek for clients, dense for operators. References: Raycast, Linear, Arc Browser.

## Color Tokens (CSS variables)

### Semantic
```
--brand-primary: #FF6B2C      (use rarely — one CTA per screen, one chart accent)
--success: #10B981
--warning: #EAB308
--danger:  #EF4444
--info:    #3B82F6
```

### Surfaces & Text (both modes via CSS vars)
```
--bg, --surface, --surface-2, --surface-3
--border, --border-hi, --border-em
--text, --text-2, --text-3, --text-4
```

### Dark Mode Compatibility Rule
**Never use hardcoded Tailwind light-mode colors** like `bg-blue-100 text-blue-700`.
Always use translucent opacity variants that work in both modes:
```
bg-blue-500/20 text-blue-400     ✓ works dark + light
bg-amber-500/10                  ✓ works dark + light
bg-blue-100 text-blue-700        ✗ invisible in dark mode
```

### Status Badge Colors (translucent, both modes)
```tsx
const SCREEN_TYPE_STYLES = {
  LED:     'bg-blue-500/20 text-blue-400',
  STATIC:  'bg-purple-500/20 text-purple-400',
  STOP:    'bg-amber-500/20 text-amber-400',
  AIRPORT: 'bg-cyan-500/20 text-cyan-400',
  BUS:     'bg-green-500/20 text-green-400',
};
const STATUS_STYLES = {
  ACTIVE:    'bg-[rgba(16,185,129,0.12)] text-[var(--success)]',
  PAUSED:    'bg-[rgba(234,179,8,0.12)] text-[var(--warning)]',
  COMPLETED: 'bg-[var(--surface-3)] text-[var(--text-3)]',
  DRAFT:     'bg-[var(--surface-3)] text-[var(--text-3)]',
};
```

### Chart Palette
```
--chart-1: #FF6B2C   --chart-2: #3B82F6   --chart-3: #8B5CF6
--chart-4: #10B981   --chart-5: #F59E0B   --chart-6: #EC4899
--chart-7: #06B6D4   --chart-8: #84CC16
```

## Typography

- `--font-display: 'Fraunces', serif` — campaign titles only (≥text-xl), never in tables or admin
- `--font-sans: 'Geist', sans-serif` — everything else
- `--font-mono: 'Geist Mono', monospace` — all numbers in tables, currency amounts

```tsx
// Campaign hero title
<h1 style={{ fontFamily: 'var(--font-display)' }} className="text-[28px] sm:text-[40px] font-medium">
```

## Border Radius
```
--radius-none: 0      (table cells)
--radius-sm: 4px      (badges, inputs, small buttons)
--radius-md: 6px      (standard buttons)
--radius-lg: 12px     (cards, dialogs)
--radius-xl: 16px     (map container, hero cards only)
--radius-full: 9999px (pills, avatars, status dots)
```

## Spacing
Admin uses tighter spacing (gap-3 = 12px). Client uses looser (gap-6 = 24px).

## Badge / Pill Pattern
```tsx
<span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] bg-[rgba(16,185,129,0.12)] text-[var(--success)]">
  <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />  {/* active dot */}
  ACTIVE
</span>
```

## Card Pattern
```tsx
<div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
```

## Table Header Pattern
```tsx
<thead className="bg-[var(--surface-2)]">
  <tr>
    <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-3)]">
```

## Empty States
Must use display font, short explanation, and one action. Never just "No data".
```tsx
<h2 style={{ fontFamily: 'var(--font-display)' }} className="text-[28px] font-medium">
  Нет кампаний
</h2>
<p className="mt-3 text-sm text-[var(--text-3)]">
  Команда Ledokol загрузит ваш первый медиаплан.
</p>
```

## Icons
- Library: Lucide React
- Default stroke: `strokeWidth={1.5}` (not default 2)
- Default size: 16px UI, 14px in dense admin rows
