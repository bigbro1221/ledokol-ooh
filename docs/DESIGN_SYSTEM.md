# OOH Dashboard — Design System

> **Project:** Ledokol Group OOH Advertising Dashboard
> **Version:** 1.0
> **Last updated:** April 2026
> **Reader:** Claude Code / development agent / designers

This document defines the visual language for the OOH Dashboard platform. It is the authoritative reference for all UI decisions. Read it before every UI task. When in doubt, this document wins over personal preference or generic "AI design" instincts.

---

## 1. Design Philosophy

### One sentence

A premium, dual-personality interface — **sleek and breathable for clients**, **dense and precise for operators** — unified by a single visual language.

### Mood board references

- **Raycast** — Precision, restraint, confident use of type
- **Arc Browser** — Personality without sacrificing professionalism
- **Framer** — Premium feel without feeling corporate
- **Linear** — Detail work in every component, nothing accidental
- **Bloomberg Terminal** — Respect for density (admin side only)

### What we're not

- Generic SaaS (Tailwind defaults, rounded-xl everything, purple gradients)
- Soft/friendly (no pastel palettes, no playful illustrations)
- Minimalist-to-the-point-of-empty (we have real data; let it breathe but let it live)

### The bold typographic choice

A **display serif for campaign titles** (campaigns feel like documents, not database rows) paired with a precise sans for UI and a sharp mono for numeric data. Most dashboards use one sans family throughout — this doesn't. The serif is where personality lives.

---

## 2. Dual Personalities

### Client side (advertisers)

- **Audience:** Busy brand managers at Ledokol's clients (T-Bank, Paynet, etc.)
- **Sessions:** Short, focused — "is my campaign performing?"
- **Density:** Balanced — dense where data needs it (tables, charts), breathable where context needs it (campaign header, empty states)
- **Spacing scale:** Generous (base unit = 4px, default gap = 24px, section gap = 48px)
- **Visual hierarchy:** Clear — one primary action per screen, obvious focal point
- **Motion:** Thoughtful transitions on filter change, chart draw-in, route change

### Admin side (Ledokol team)

- **Audience:** Power users managing multiple clients/campaigns simultaneously
- **Sessions:** Long, multi-step — create client, upload XLSX, verify parse, adjust
- **Density:** High — fit more on screen, use compact controls, consolidated nav
- **Spacing scale:** Compact (base unit = 4px, default gap = 12px, section gap = 24px)
- **Visual hierarchy:** Flatter — fast scanning, keyboard-first, minimal hand-holding
- **Motion:** Minimal — instant feedback over polish

Both sides share the same color system, typography, and component library. Only spacing and density differ.

---

## 3. Color System

### Brand colors

> **Status:** Pending brand book from Ledokol. This section uses temporary values derived from Geomotive's orange as placeholder. **When brand book arrives, update only this subsection — all other tokens will cascade.**

```
--brand-primary: #FF6B2C     /* Ledokol orange — placeholder */
--brand-primary-hover: #FF8555
--brand-primary-active: #E55A1F
--brand-primary-subtle: rgba(255, 107, 44, 0.12)
```

### Semantic colors (shared across light and dark)

```
--success: #10B981    /* Active campaign, positive trend */
--warning: #EAB308    /* Approaching threshold, needs attention */
--danger:  #EF4444    /* Error, over budget, expired */
--info:    #3B82F6    /* Informational badges */
```

### Light mode palette

```
/* Surfaces */
--bg:         #FAFAF8    /* Slightly warm white, not #FFFFFF — feels premium */
--surface:    #FFFFFF
--surface-2:  #F5F5F2    /* Card inner sections, subtle differentiation */
--surface-3:  #ECECE8    /* Hover states, pressed states */

/* Borders */
--border:     #E5E5E0
--border-hi:  #D4D4CE    /* Hover/focus states */
--border-em:  #1A1A1F    /* Emphasis — focused inputs, active states */

/* Text */
--text:       #1A1A1F    /* Not pure black — feels softer but still confident */
--text-2:     #525255
--text-3:     #8A8A8C    /* Muted — metadata, labels */
--text-4:     #B5B5B7    /* Placeholder, disabled */
```

### Dark mode palette

```
/* Surfaces — intentionally dark but not pure black */
--bg:         #0A0A0F    /* Deep navy-black, not #000 */
--surface:    #12121A
--surface-2:  #1A1A24
--surface-3:  #242430

/* Borders */
--border:     #2A2A38
--border-hi:  #3A3A48
--border-em:  #FFFFFF

/* Text */
--text:       #EDEDF0
--text-2:     #A0A0A8
--text-3:     #6D6D75
--text-4:     #45454D
```

### Color usage rules

1. **Brand primary is rare.** Use it for: primary CTA per screen, active nav item, one accent per chart. Never for chart axes, borders, or body text.
2. **Semantic colors signal state, not decoration.** Never use green just because "it looks nice" — it must mean something.
3. **Text hierarchy uses 4 levels only** (`--text`, `--text-2`, `--text-3`, `--text-4`). Avoid inventing intermediate shades.
4. **Charts use a dedicated palette** (see section 9), not arbitrary picks from the color system.

---

## 4. Typography

### Font families

```css
--font-display: 'Fraunces', 'Georgia', serif;
  /* Campaign titles, hero headings. Slight optical size flex. */

--font-sans: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
  /* UI, body, everything else. Strong Cyrillic + Uzbek coverage. */

--font-mono: 'Geist Mono', 'JetBrains Mono', ui-monospace, monospace;
  /* Numbers in data tables, IDs, code, timestamps. */
```

**Why this combo:**
- **Fraunces** — Variable serif with an opinion. Campaign names feel significant, not utility.
- **Geist** — Vercel's sans. Modern, precise, excellent Cyrillic, free.
- **Geist Mono** — Same family consistency for numbers.

**Why not Inter:** Overused, feels AI-generic. Geist has more personality while still being highly legible.

**Why not pure sans-only:** Every dashboard does that. The serif is our differentiator.

### Type scale

```
--text-xs:   11px / 16px line / tracking 0.02em / weight 500    /* Labels, badges */
--text-sm:   13px / 20px / 0 / 400                              /* Secondary UI */
--text-base: 14px / 22px / -0.01em / 400                        /* Body default */
--text-md:   16px / 24px / -0.01em / 400                        /* Emphasized body */
--text-lg:   18px / 26px / -0.015em / 500                       /* Sub-headings */
--text-xl:   22px / 30px / -0.02em / 600                        /* Section headings */
--text-2xl:  28px / 36px / -0.025em / 600                       /* Page titles */
--text-3xl:  36px / 44px / -0.03em / 700                        /* Hero / KPI values */
--text-4xl:  48px / 56px / -0.035em / 700                       /* Rare — landing / empty states */
```

### Font usage rules

1. **Display serif (Fraunces)** used for: campaign names in dashboards, empty state headings, login page hero, section titles on landing (if any). Always at `--text-xl` or larger. **Never in tables or admin UI.**
2. **Sans (Geist)** default for everything else. Use weight 400 for body, 500 for emphasis, 600 for headings, 700 rarely (only hero KPIs).
3. **Mono (Geist Mono)** used for: all numeric values in tables, campaign IDs, dates/times when compact, currency amounts (optional — can also use sans tabular numerics). Always use `font-variant-numeric: tabular-nums` for mono numbers to align columns.
4. **Never mix display serif with body serif.** Fraunces stays in its lane.

### Language considerations

All three font families have verified Cyrillic support. For Uzbek Latin (O'zbek) the standard Latin glyphs work. For Turkish, all diacritics (ç, ğ, ı, ö, ş, ü) are covered. If a glyph is missing in Geist, fall back to system sans — never introduce a fourth font.

---

## 5. Spacing Scale

Based on a 4px grid. Never use arbitrary pixel values.

```
--space-0:  0
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
--space-20: 80px
--space-24: 96px
```

### Spacing conventions

- **Client side default gap:** `--space-6` (24px) between major blocks
- **Client side section gap:** `--space-12` (48px) between page sections
- **Admin side default gap:** `--space-3` (12px)
- **Admin side section gap:** `--space-6` (24px)
- **Inline component padding:** `--space-3` (12px) horizontal, `--space-2` (8px) vertical — buttons, badges
- **Card padding:** `--space-6` (24px) client, `--space-4` (16px) admin
- **Table cell padding:** `--space-3` (12px) horizontal, `--space-2` (8px) vertical

---

## 6. Shape & Depth

### Border radius — mixed intentionally

```
--radius-none: 0       /* Data tables, table cells */
--radius-sm:   4px     /* Inputs, small buttons, badges */
--radius-md:   6px     /* Standard buttons, input groups */
--radius-lg:   12px    /* Cards, dialogs, major containers */
--radius-xl:   16px    /* Hero cards, map container */
--radius-full: 9999px  /* Avatars, pills, status dots */
```

### Radius usage rules

1. **Data tables use `--radius-none`** — the table container can have radius, but cells are sharp. Data feels precise when corners are sharp.
2. **Cards use `--radius-lg`** — soft, inviting, feels premium.
3. **Buttons use `--radius-md`** — between sharp and soft; confident.
4. **Pills/badges/status dots use `--radius-full`**.
5. **Never use `--radius-xl` except** for the map container and campaign hero cards.

### Shadows

Subtle, used sparingly. Not for every card — only for elevation states.

```
--shadow-sm:    0 1px 2px rgba(0,0,0,0.04)
--shadow-md:    0 2px 8px rgba(0,0,0,0.06)
--shadow-lg:    0 8px 24px rgba(0,0,0,0.08)
--shadow-xl:    0 16px 48px rgba(0,0,0,0.12)
--shadow-glow:  0 0 0 1px var(--brand-primary), 0 0 20px var(--brand-primary-subtle)  /* Focus ring on key elements */
```

Dark mode uses same values — the rgba math naturally adapts.

### Border vs shadow for depth

**Default to borders, not shadows.** Shadows should feel like a deliberate statement. A card at rest = 1px border. A card on hover = same border plus `--shadow-sm`. A dialog = `--shadow-lg`. A dropdown = `--shadow-md`.

---

## 7. Motion

### Easing

```
--ease-out-soft:   cubic-bezier(0.22, 0.61, 0.36, 1)    /* Default for most things */
--ease-out-sharp:  cubic-bezier(0.16, 1, 0.3, 1)         /* Fast arrivals — charts, reveals */
--ease-in-out:     cubic-bezier(0.65, 0, 0.35, 1)        /* Symmetrical, for toggles */
```

### Duration

```
--duration-fast:   120ms  /* Hover states, focus rings, color changes */
--duration-base:   200ms  /* Default for most transitions */
--duration-slow:   320ms  /* Page transitions, chart redraws */
--duration-slower: 500ms  /* Orchestrated entrance animations */
```

### Animation patterns

1. **Filter change** — charts fade out at 120ms, new data fades in at 200ms with `--ease-out-sharp`. Never abrupt swaps.
2. **Route change (client side)** — staggered 80ms delay between KPI cards as they enter. Creates a "materializing" feeling. Admin side: skip this, instant is better for power users.
3. **Hover states** — 120ms color/border transitions. Never transition `transform` or `box-shadow` together (jitter).
4. **Dropdowns/popovers** — 200ms fade + 4px translate-y from above. Always `--ease-out-sharp`.
5. **Chart draw-in** — 600ms line draw or bar grow. Once per page load, never on filter change.
6. **Respect `prefers-reduced-motion`** — disable all non-essential animation. Chart data still renders, just instantly.

### What never animates

- Font weight changes (causes layout shift)
- Anything in data tables on sort/filter (users want instant feedback)
- Admin forms (utility over delight)

---

## 8. Component Patterns

### Buttons

**Primary button**
```
background: var(--brand-primary)
color: white
padding: var(--space-3) var(--space-5)
border-radius: var(--radius-md)
font-size: var(--text-sm)
font-weight: 500
transition: background var(--duration-fast) var(--ease-out-soft)

hover: background: var(--brand-primary-hover)
active: background: var(--brand-primary-active)
focus: box-shadow: var(--shadow-glow)
disabled: opacity: 0.4, cursor: not-allowed
```

**Secondary button** — transparent bg, 1px border, same sizing.
**Ghost button** — transparent bg, no border, subtle hover bg.
**Destructive button** — same shape as primary, but `--danger` color.

### Inputs

```
background: var(--surface)
border: 1px solid var(--border)
border-radius: var(--radius-sm)
padding: var(--space-2) var(--space-3)
font-size: var(--text-sm)

focus: border-color: var(--border-em), box-shadow: 0 0 0 3px var(--brand-primary-subtle)
error: border-color: var(--danger)
```

### Cards

```
background: var(--surface)
border: 1px solid var(--border)
border-radius: var(--radius-lg)
padding: var(--space-6)          /* client */
padding: var(--space-4)          /* admin */

hover (if interactive): border-color: var(--border-hi), box-shadow: var(--shadow-sm)
```

### Tables

```
/* Container */
border: 1px solid var(--border)
border-radius: var(--radius-lg)
overflow: hidden

/* Header row */
background: var(--surface-2)
border-bottom: 1px solid var(--border)
font-size: var(--text-xs)
font-weight: 500
letter-spacing: 0.02em
text-transform: uppercase
color: var(--text-3)

/* Body rows */
border-bottom: 1px solid var(--border)
font-size: var(--text-sm)

/* Cell padding */
padding: var(--space-3)
vertical-align: middle

/* Hover */
background: var(--surface-2)

/* Numeric columns */
font-family: var(--font-mono)
font-variant-numeric: tabular-nums
text-align: right
```

### Badges / Status pills

```
border-radius: var(--radius-full)
padding: 2px var(--space-3)
font-size: var(--text-xs)
font-weight: 500
text-transform: uppercase
letter-spacing: 0.04em

/* Status variants — subtle bg + colored text */
.active   { bg: rgba(16,185,129,0.12); color: var(--success); }
.paused   { bg: rgba(234,179,8,0.12); color: var(--warning); }
.done     { bg: var(--surface-3); color: var(--text-3); }
.error    { bg: rgba(239,68,68,0.12); color: var(--danger); }
```

### Empty states

Not an afterthought. Every empty state is an opportunity to add personality.

- Display serif heading (`--font-display`, `--text-xl`)
- Short explanation in body sans
- Subtle illustration OR monogrammed icon (never stock illustrations)
- One primary action button

**Example for "No campaigns yet" (client side):**
> **No campaigns here yet.**
> Ledokol's team will upload your first media plan here. You'll see analytics and maps appear automatically.

---

## 9. Charts & Data Visualization

### Chart color palette

Use this specific 8-color sequence for all charts. Never substitute semantic colors (green/red/etc.) into chart data palettes — those belong to state, not data.

```
--chart-1: #FF6B2C    /* Brand primary */
--chart-2: #3B82F6    /* Blue */
--chart-3: #8B5CF6    /* Violet */
--chart-4: #10B981    /* Green — used here in chart context only */
--chart-5: #F59E0B    /* Amber */
--chart-6: #EC4899    /* Pink */
--chart-7: #06B6D4    /* Cyan */
--chart-8: #84CC16    /* Lime */
```

### Chart conventions

1. **Axis text** — `--text-xs`, `--text-3` color, tabular nums.
2. **Gridlines** — 1px, `--border` color, never bolder.
3. **Tooltip** — dark surface (opposite of current mode), `--radius-md`, `--shadow-lg`, mono for numbers.
4. **Legend** — small square swatches (`--radius-sm`, 8px), label in `--text-xs`, `--text-2` color.
5. **Empty state** — single line in `--text-3`: "Data available after operator API integration" or "No data for this period."
6. **Loading state** — subtle pulse animation on skeleton bars, never a spinner.

### Specific widgets (reference Geomotive only for these)

**Donut chart (Impressions by operator/type)** — Keep Geomotive's execution: thick donut, center total, percentages on slices, legend below. Use our chart palette. Interactive: hover slice shows exact value; click legend toggles slice.

**Map (Screens by location)** — Mapbox dark style in dark mode, light style in light mode. Markers colored by our `--chart-*` palette based on screen type. Marker cluster uses pill shape with count. Popup: card with `--radius-lg`, `--shadow-lg`, 240px wide, photo thumbnail at top.

**Things NOT to copy from Geomotive:**
- Their weak empty states ("Нет данных" as plain centered text — ours uses the empty state pattern from section 8)
- Their flat KPI cards — ours have more structure and one accent element
- Their legend pagination ("1/2" arrows) — we let the legend wrap naturally

---

## 10. Iconography

- **Library:** Lucide React. Consistent, clean, great coverage.
- **Default size:** 16px in UI, 20px in buttons, 24px in empty states, 32px in hero contexts.
- **Default stroke:** 1.5px (Lucide default is 2px — we override for more refinement).
- **Color:** Inherits text color. Never colored unless indicating state.
- **Never use:** Emoji in UI (use icons), filled icons alongside outline icons (pick one per context), icons as decoration (must mean something).

---

## 11. Layout Patterns

### Client dashboard layout

```
┌────────────────────────────────────────────────────┐
│ Top nav: logo — campaign selector — date range    │  64px height
├────────────────────────────────────────────────────┤
│                                                    │
│  Campaign hero (name in Fraunces, period, status) │  spacing: space-6
│                                                    │
│  ┌──────────┬──────────┬──────────┬──────────┐   │
│  │ KPI card │ KPI card │ KPI card │ KPI card │   │  grid: 4 cols
│  └──────────┴──────────┴──────────┴──────────┘   │
│                                                    │
│  ┌──────────────────────┬──────────────────────┐  │
│  │ Chart 1 (donut)      │ Chart 2 (area)       │  │  grid: 2 cols
│  └──────────────────────┴──────────────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ Map (full width, rounded-xl)                 │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ Screens table                                │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
└────────────────────────────────────────────────────┘

Container: max-width 1440px, centered, horizontal padding space-8
Mobile: all grids collapse to 1 column, nav compacts
```

### Admin layout

```
┌──────┬──────────────────────────────────────────┐
│ Side │ Top bar: breadcrumbs — search — user    │  48px (denser)
│ nav  ├──────────────────────────────────────────┤
│      │                                          │
│ 240px│ Content area                             │
│      │ Padding: space-6 all sides               │
│      │                                          │
│      │ Tables / forms / upload UIs              │
│      │                                          │
└──────┴──────────────────────────────────────────┘

Side nav: collapses to 56px icon rail on smaller screens
Tables here allow horizontal scroll without reflow
```

---

## 12. Dark Mode Specifics

Not just inverted colors. Dark mode needs its own attention:

1. **Reduce contrast of large text** — pure white on pure black is aggressive. Use `--text` (#EDEDF0) on `--bg` (#0A0A0F).
2. **Borders are more important in dark mode** — slightly brighter `--border` to compensate for weaker depth cues.
3. **Shadows barely work in dark mode** — rely on borders and subtle surface elevation instead.
4. **Images and photos need a subtle overlay** — apply `backdrop-filter: brightness(0.9)` to photos to prevent visual pop.
5. **Charts** — the chart palette works in both modes. No separate dark-mode palette.
6. **Map** — Mapbox has a dedicated dark style. Switch based on mode.

---

## 13. Accessibility Requirements

- **Contrast ratios** — body text must meet WCAG AA (4.5:1), large text 3:1. Tested for both modes.
- **Focus rings** — always visible, never suppressed. Our focus ring uses `--shadow-glow` — a 1px solid brand ring plus subtle glow.
- **Keyboard navigation** — every interactive element reachable via Tab. Dropdowns close on Escape. Modals trap focus.
- **Color is never the only signal** — status uses both color AND label. Charts provide text alternatives.
- **Respect `prefers-reduced-motion`** — non-essential animation disabled.
- **Minimum tap targets** — 44×44px for mobile interactions.

---

## 14. Do / Don't Summary

| DO | DON'T |
|---|---|
| Use Fraunces for campaign titles | Use Fraunces in tables or admin UI |
| Use borders as primary depth cue | Rely on shadows everywhere |
| Use brand color once or twice per screen | Paint the screen orange |
| Let data tables have sharp corners | Round everything for "consistency" |
| Reference `--space-*` tokens | Write arbitrary px values |
| Respect density differences | Make admin and client feel identical |
| Use mono for numbers in tables | Use sans numerics in tables (misaligns) |
| Animate filter changes | Animate table sorts |
| Test dark mode separately | Assume inverted colors suffice |
| Write empty states with personality | Use "No data" as empty state |

---

## 15. Implementation Notes for Claude Code

### Tailwind config

All tokens in this document map to Tailwind custom properties. Set up `tailwind.config.ts` so `bg-brand-primary`, `text-text-3`, `rounded-lg`, `p-space-6` etc. all resolve to the CSS variables above. This lets us swap the brand book values later without touching component code.

### shadcn/ui

Use shadcn components as the base but customize the default theme to match this system:
- Override `border-radius` defaults per component (Button = `--radius-md`, Card = `--radius-lg`, Input = `--radius-sm`)
- Override color tokens (`primary` = `--brand-primary`, `background` = `--bg`, etc.)
- Replace default fonts with our three-font stack

### Component library

Build these as reusable components in `/components/ui/` from day one:
- `Button` (variants: primary, secondary, ghost, destructive; sizes: sm, md, lg)
- `Input`, `Select`, `DatePicker`
- `Card` (with density prop: 'client' | 'admin')
- `Table` (with numeric column detection)
- `Badge` (with status variant)
- `KPICard` (value + label + optional trend indicator)
- `EmptyState` (heading + description + action)
- `ThemeToggle`

### Theme switching

Use `next-themes` or equivalent for light/dark toggle. Persist in localStorage. Default to system preference. Transition between modes: `transition: background-color, color, border-color 150ms var(--ease-out-soft)` on `body`.

### When brand book arrives

Update only section 3.1 (Brand colors). All downstream tokens reference those variables, so a single edit propagates everywhere. Verify contrast ratios still meet WCAG.

---

## 16. What's NOT Specified (Agent Decides)

For anything not covered explicitly in this document:

- The agent defers to the `frontend-design` skill (Anthropic) for overall visual quality decisions
- Then `react-best-practices` (Vercel) + `react-expert` (Jeff Allan) for component structure
- When truly uncertain, ask the user — don't guess on visual direction

Specifically, the agent has freedom on:
- Exact microcopy (but keep tone: precise, confident, never cute)
- Placement of secondary actions within cards
- Illustrative icons within empty states (as long as they follow iconography rules)
- Individual chart tooltip content structure

---

## 17. Reference

- Geomotive screenshots: `docs/references/geomotive-*.png` — for chart + map patterns only
- Brand book: **TBD** — will live at `docs/brand/ledokol-brand-book.pdf` once received
- Font licenses: Geist (SIL OFL), Fraunces (SIL OFL) — both free for commercial use
- Mapbox style IDs: standard light / standard dark
