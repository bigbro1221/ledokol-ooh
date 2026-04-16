# Claude Code Kickoff Prompt — OOH Dashboard Phase 1

Paste the commands/prompts below into Claude Code after you've:
1. Created a new GitHub repo (empty)
2. Cloned it locally
3. Copied `ARCHITECTURE.md` into `docs/ARCHITECTURE.md` in the repo
4. Copied the sample XLSX (`ЧЕРНОВИК.xlsx`) into `docs/samples/` for parser reference later
5. Started Claude Code in the repo root

---

## A Note on Skill Selection

You proposed a list of skill sources. I vetted each one — some are legitimate and valuable, some I couldn't verify, and some overlap with better alternatives. Here's the decision table:

| Your proposal | Verdict | Reasoning |
|---|---|---|
| `vercel-labs/agent-skills/react-best-practices` | ✅ **Use** | Real repo (20k+ stars), Vercel-maintained, covers production React patterns. Valuable. |
| `anthropics/skills/frontend-design` | ✅ **Use** | Official Anthropic skill. Covers visual design quality, avoiding generic AI aesthetics. Great for Phase 3–4. |
| `anthropics/skills/webapp-testing` | ✅ **Use** | Official. Playwright-based E2E testing. I already had this. |
| `jeffallan/claude-skills` → `react-expert`, `postgres-pro` | ✅ **Use** | Real repo (66 specialized skills), MIT, plugin-installable. Higher quality than custom skills for these domains. Supersedes parts of my `nextjs-app-conventions` and `prisma-ooh-schema`. |
| `skillfish add pluginagentmarketplace/custom-plugin-postgresql postgresql-fundamentals` | ⚠️ **Replaced** | I couldn't verify `pluginagentmarketplace/custom-plugin-postgresql` exists. Jeff Allan's `postgres-pro` covers the same ground and is verified. |
| `mcp.directory/skills/api-design-principles` | ⚠️ **Replaced** | Couldn't verify this specific skill. Replaced with Jeff Allan's `api-designer` which covers API design principles. |
| `openskills install alirezarezvani/claude-code-tresor` | ⚠️ **Optional** | Couldn't find clear documentation for this one. Skipping by default; you can add if you verify it yourself. |
| `skillsdirectory.com/skills/alirezarezvani-security-auditor` | ⚠️ **Replaced** | Replaced with Jeff Allan's `security-reviewer` — verified, well-documented. |

**Net result:** Mixing official Anthropic skills, Vercel's React skills, and Jeff Allan's full-stack skills gives us high-quality community skills for React, Postgres, API design, security, and testing. Our custom project-specific skills then focus on Ledokol-specific logic (XLSX format, Yandex Maps matching, Ledokol domain model).

---

## Step 1: Install Skill Marketplaces

In Claude Code, run these in order:

### 1a. Official Anthropic skills
```
/plugin marketplace add anthropics/skills
/plugin install example-skills@anthropic-agent-skills
/plugin install document-skills@anthropic-agent-skills
```

Gives access to: `xlsx`, `pdf`, `docx`, `frontend-design`, `webapp-testing`, `web-artifacts-builder`, `skill-creator`, `mcp-builder`.

### 1b. Jeff Allan's full-stack skills (66 skills)
```
/plugin marketplace add jeffallan/claude-skills
/plugin install fullstack-dev-skills@jeffallan
```

Gives access to (relevant ones): `react-expert`, `nextjs-developer`, `typescript-pro`, `postgres-pro`, `sql-pro`, `api-designer`, `security-reviewer`, `test-master`, `debugging-wizard`, `code-reviewer`.

### 1c. Vercel's React best practices
If Vercel's repo supports plugin marketplace format:
```
/plugin marketplace add vercel-labs/agent-skills
/plugin install all@vercel-labs-skills
```

If that doesn't work, use the `skills` npm CLI which handles any repo:
```
npx skills add vercel-labs/agent-skills --skill react-best-practices -a claude-code
```

### 1d. Verify installation
```
/plugin list
```

You should see at least the Anthropic + Jeff Allan marketplaces installed. The Vercel React skill should appear in your active skills list.

---

## Step 2: The Main Prompt

Paste this into Claude Code:

```
I'm starting a new project. Before doing anything, read docs/ARCHITECTURE.md in full — it's the authoritative spec for this project and explains what we're building, the tech stack, data model, and build phases.

You have access to the following external skills via installed marketplaces:

FROM anthropic-agent-skills:
- xlsx — spreadsheet parsing (used by our XLSX parser work in Phase 2)
- skill-creator — creating new skills (used below)
- frontend-design — production-grade frontend design (Phase 3–4)
- webapp-testing — Playwright E2E testing (Phase 3–5)
- web-artifacts-builder — Tailwind + shadcn/ui patterns (Phase 3–4)

FROM jeffallan/claude-skills:
- react-expert — advanced React patterns, Server Components
- nextjs-developer — Next.js-specific patterns, App Router
- typescript-pro — TypeScript strict mode, advanced types
- postgres-pro — PostgreSQL optimization, query patterns
- sql-pro — complex SQL, performance tuning
- api-designer — REST API design principles
- security-reviewer — code security auditing
- test-master — testing strategy and implementation
- debugging-wizard — systematic debugging
- code-reviewer — code quality review

FROM vercel-labs/agent-skills:
- react-best-practices — production React from the Vercel team

Your task right now is TWO things:
1. Create a set of project-specific skills that complement the above (section A)
2. Execute **Phase 1 — Foundation** as defined in section 9 of the architecture doc (section B)

---

## Section A: Create project-specific skills

Use the `skill-creator` skill to create the following skills in `.claude/skills/` in this repo. These are for Ledokol-specific logic that generic skills don't cover — they extend and reference the external skills where appropriate.

### 1. `xlsx-media-plan-parser`
- **When to trigger:** Any task involving parsing the Ledokol media plan XLSX format (7 sheets: LED Ташкент, LED Регионы, LED Остановки, Статика, Аэропорт, Автобусы, Total)
- **Content:** Reference section 6 of ARCHITECTURE.md. Include the column alias mapping, hyperlink extraction pattern (cell.l.Target), Google Drive URL normalization, and Zod validation approach. Sample file path: docs/samples/ЧЕРНОВИК.xlsx.
- **References:** Builds on top of the official `xlsx` skill — link to it for generic spreadsheet patterns, focus this skill on Ledokol's specific format.

### 2. `yandex-maps-geocoder`
- **When to trigger:** Extracting coordinates from Yandex Maps Constructor links or matching pin labels to spreadsheet addresses
- **Content:** Reference sections 6.7 and 6.8 of ARCHITECTURE.md. Include the constructor ID extraction regex, GeoJSON fetch URL format, the fuzzy matching algorithm (normalize → extract keywords → overlap ratio → 0.35 threshold), the proven 96% match rate benchmark.

### 3. `ledokol-domain-model`
- **When to trigger:** Any work involving the OOH advertising domain — campaigns, screens, operators, pricing, OTS/rating metrics, Russian/Uzbek OOH terminology
- **Content:** Glossary from section 15 of ARCHITECTURE.md. Business rules: spreadsheet is source of truth for data entry, DB is source of truth for rendering, Ledokol is sole operator in MVP but schema supports multi-operator, DataSource enum (xlsx/api) for future API integration. Reference the Prisma schema from section 5.1.
- **References:** Use `postgres-pro` for DB optimization patterns, `api-designer` for API endpoint design.

### 4. `dashboard-widgets-ledokol`
- **When to trigger:** Building dashboard charts, KPI cards, or filter-reactive components for the client-side OOH dashboard
- **Content:** Reference section 8 of ARCHITECTURE.md. Cover: Recharts config for area/donut/bar charts matching Geomotive reference style, Tremor KPI card patterns, empty state pattern for post-MVP widgets ("Data available after operator API integration"), filter reactivity via URL search params.
- **References:** Use `frontend-design` (Anthropic) for visual quality, `react-best-practices` (Vercel) for React patterns, `react-expert` (Jeff Allan) for advanced component patterns.

### 5. `mapbox-ooh-screens`
- **When to trigger:** Any Mapbox GL JS work — markers, popups, clustering, heatmap layers for OOH screen locations
- **Content:** Marker cluster config for 100+ screens, color-by-screen-type mapping (LED/static/stop/airport/bus), popup HTML template showing address/size/OTS/photo thumbnail, heatmap toggle layer config, bounds auto-fit logic.

For each skill:
- Follow the YAML frontmatter convention from the official Agent Skills spec
- Write "pushy" descriptions per the Anthropic skill authoring guide (skills under-trigger by default)
- Keep SKILL.md content focused — link to ARCHITECTURE.md sections and external skills rather than duplicating content
- Explicitly note which external skills each project skill builds on top of
- After creating all 5, verify they're in `.claude/skills/` and each has valid SKILL.md frontmatter

Why only 5 project-specific skills this time (previously I listed 6): `nextjs-app-conventions` and `prisma-ooh-schema` are now replaced by Jeff Allan's verified `nextjs-developer` + `postgres-pro` plus this project's `ledokol-domain-model` skill, which is more focused.

---

## Section B: Execute Phase 1 — Foundation

Phase 1 deliverables (from architecture doc section 9):

- Next.js 14+ project with App Router and TypeScript (strict mode). Use `nextjs-developer` and `typescript-pro` skills.
- PostgreSQL via Docker Compose for local dev. Use `postgres-pro` for schema tuning.
- Prisma ORM with the full schema from section 5 of the architecture doc. Cross-reference with `ledokol-domain-model` skill you create.
- NextAuth.js v5 configured with credentials provider and two roles (ADMIN, CLIENT). Use `security-reviewer` to audit auth setup.
- Middleware that protects /admin/* routes (admin only) and /dashboard/* routes (authenticated only).
- next-intl for i18n with 4 locales (ru, en, uz, tr) — RU default, scaffold structure with empty translation files for EN/UZ/TR.
- Basic layout shells:
  - /[locale]/admin/layout.tsx with sidebar nav placeholder
  - /[locale]/dashboard/layout.tsx with top nav placeholder
  - /[locale]/login/page.tsx with working login form (apply `frontend-design` skill for visual quality)
- `/api/health` endpoint returning DB connection status. Use `api-designer` for endpoint structure.
- Dockerfile for the Next.js app
- docker-compose.yml with app + Postgres + MinIO services
- GitHub Actions workflow running on PR: lint, typecheck, prisma validate. Use `test-master` for CI strategy.
- Comprehensive README.md with local setup instructions
- .env.example with all required variables documented

Follow the file structure convention in section 13 of the architecture doc exactly.

Do NOT build any business logic yet — no client CRUD, no campaign forms, no XLSX parser. That's Phase 2. Only build the foundation.

Technical requirements:
- App Router exclusively, not Pages Router
- Server Components by default, Client Components only where needed (consult `react-best-practices` and `react-expert`)
- TypeScript strict mode must pass with zero errors
- Prisma client singleton via globalThis caching (consult `postgres-pro`)
- Use bcryptjs for password hashing
- JWT stored in HTTP-only cookies via NextAuth
- Include at minimum: next, react, typescript, prisma, @prisma/client, next-auth (v5 beta), next-intl, zod, bcryptjs, tailwindcss

Final verification steps:
1. Run `npm install` and verify it completes cleanly
2. Run `prisma generate` and verify types are generated
3. Run `tsc --noEmit` to verify no type errors
4. Run the lint task to verify no lint errors
5. Confirm all 5 project skills are present in `.claude/skills/`
6. Print a summary of what was built, how to run it locally, what skills were created, what external skills are available, and what's intentionally NOT done yet

Start by reading docs/ARCHITECTURE.md. Ask clarifying questions ONLY if something in the spec is genuinely ambiguous or contradictory. Otherwise, build.
```

---

## Notes on Using This Prompt

### Why this curated skill set works together

- **Anthropic official** — Foundation for document handling (XLSX), design quality (frontend-design), and skill creation itself
- **Jeff Allan's 66-skill collection** — Depth in specific technologies (React, Postgres, security, testing). MIT-licensed, plugin-installable, actively maintained
- **Vercel React** — Specifically React patterns from the company that maintains Next.js
- **Your 5 project-specific skills** — Ledokol domain knowledge, XLSX format, Yandex Maps matching, dashboard patterns, Mapbox config

Think of it as layers:
1. **External skills** answer "how do we do X in this tech stack?" (React, Postgres, testing)
2. **Project skills** answer "how does Ledokol do X specifically?" (their XLSX, their map, their dashboards)

### Conflict resolution

When an external skill and project skill seem to conflict, project skills win — they know Ledokol's requirements. The XLSX skill (Anthropic) covers generic multi-sheet parsing; `xlsx-media-plan-parser` knows about the specific 7 sheets and column aliases. Claude Code should layer them: generic knowledge from external, specific knowledge from project.

### Installing additional skills mid-build

If during development you find useful skills elsewhere, use `skillfish` or `npx skills`:
```
npx skills add <owner>/<repo> --skill <skill-name> -a claude-code
```

Both `skillfish` and `openskills` are universal CLIs that work with any SKILL.md repo. Good for one-off additions without committing to a full marketplace.

### After Phase 1

Subsequent phase kickoffs become shorter — the skills do the "how" so you just specify the "what":

**Phase 2:** *"Read ARCHITECTURE.md sections 6 and 9 (Phase 2). Use xlsx-media-plan-parser, yandex-maps-geocoder, ledokol-domain-model, and postgres-pro skills. Build the admin CRM and XLSX parser. Test against docs/samples/ЧЕРНОВИК.xlsx."*

**Phase 3:** *"Read section 8 and Phase 3. Use dashboard-widgets-ledokol, frontend-design, react-expert, and react-best-practices. Build the client dashboard charts and KPIs."*

**Phase 4:** *"Read section 8 (map section) and Phase 4. Use mapbox-ooh-screens, frontend-design. Build the map and screens table."*

**Phase 5:** *"Read Phase 5. Use webapp-testing, test-master, security-reviewer, code-reviewer. Polish, test, and harden for production."*

### Watch-outs during Phase 1

- NextAuth v5 is in beta. If compatibility issues arise, fall back to v4 with a note in the architecture doc.
- Prisma + Next.js App Router connection-pooling pitfall: singleton must use `globalThis` caching. `postgres-pro` covers this.
- `next-intl` middleware can conflict with NextAuth middleware. Usually NextAuth wraps next-intl.
- `.gitignore` excludes `.env`, `node_modules`, `.next`, `prisma/generated`. Do NOT exclude `.claude/skills/` — those are project knowledge.
- If plugin commands fail (marketplace not recognized, etc.), fall back to cloning repos directly into `.claude/skills/`. Document what happened.

---

## Meta-tip

Three knowledge layers keep this project coherent:
1. `docs/ARCHITECTURE.md` — the "what" and "why"
2. `.claude/skills/*/SKILL.md` — the "how" for Ledokol-specific logic
3. External installed skills — the "how" for general tech patterns

When something changes, update the architecture doc first, then affected skills, then tell Claude Code. Keeping all three in sync is what separates a coherent 10-week project from a chaotic one.
