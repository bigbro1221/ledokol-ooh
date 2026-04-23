# Auth Roadmap — Ledokol OOH Dashboard

> **Owner:** Beck Rakhimov  
> **Last updated:** 2026-04-23  
> **Stack:** Next.js 14 · TypeScript · Prisma 6 · PostgreSQL · NextAuth 5 (beta)

> **Shipping log:**  
> • 2026-04-22 — Google OAuth shipped (sign-in + account linking on `/profile`).  
> • 2026-04-22 — `signIn` callback blocks Google signup for emails not in User table.  
> • 2026-04-22 — Mandatory Google-link gate: non-linked users redirected to `/profile?mustLinkGoogle=1`.  
> • 2026-04-23 — Phase A: SES email client, suppression table, SNS webhook, MX + typo validation on user creation.  
> • 2026-04-23 — Phase B: Passwordless OTP login — `EmailLoginCode` + `RateLimitEntry` schema, DB-backed rate limiter, `POST /api/auth/send-code`, double-submit CSRF, `lib/auth.ts` Credentials rewrite, login form two-view UI, login-code email template (RU/EN/UZ), `session.maxAge` set to 24 h.

---

## Locked-in design (passwordless)

| Concern | Decision |
|---------|----------|
| Passwords | **None.** `passwordHash` will be dropped in Phase C migration. |
| Activation | Admin creates user (INVITED) → magic link email → user clicks → must link Google → status ACTIVE. |
| Login | Email input → **"Send code"** (6-digit OTP, 10-min TTL) **or** "Sign in with Google". No passwords. |
| 2FA / TOTP | **Dropped.** Google accounts carry their own 2FA. No TOTP, no recovery codes. |
| Google linking | Mandatory for all users. Already enforced as a soft gate (redirect). |
| Session | 24 h JWT. Re-verify via code or Google after expiry. |
| Rate limits | 60 s resend cooldown; 5 codes / email / hour; 20 codes / IP / hour. |
| Existing users | Migration: clear `passwordHash`, set status ACTIVE, they hit the Google-link gate on next login. |

---

## Phase 0 — Current State (as of 2026-04-23)

| Area | State |
|------|-------|
| Auth library | NextAuth 5.0.0-beta.25, Credentials + Google providers |
| Session | Stateless JWT, 24 h not yet enforced (NextAuth default) |
| Password | bcryptjs (cost 12), `passwordHash` non-nullable on `User` — **to be dropped in Phase C** |
| User creation | Admin form at `/admin/users/new`, sets password on behalf of user |
| Google SSO | Shipped — sign-in + account linking on `/profile` |
| Mandatory Google link | Shipped — soft gate via redirect on all protected pages |
| Role model | `ADMIN` / `CLIENT`, enforced in middleware + `requireAdmin()` |
| Account disable | `enabled` boolean on `User`; disabled users rejected at `authorize` |
| Rate limiting | In-memory map in `lib/api-auth.ts` — 10 attempts / 60 s / key; resets on cold start |
| Email | **Not wired.** Phase A sets up the plumbing. |

---

## Phase A — Email Plumbing ✅ IN PROGRESS

**Goal:** Safe, reliable transactional email before anything else is built on top of it.

### A.1 SES client (`lib/mail.ts`) ✅
- `sendEmail({ to, subject, html, text, tags?, replyTo? })` returning `{ messageId }`.
- Reads `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_FROM_ADDRESS`.
- Pre-send suppression check — throws `SuppressedEmailError` if address is suppressed.
- Structured error logging on SES failure.

### A.2 Suppression table + helpers ✅
Schema: `SuppressedEmail` model with `SuppressionReason` enum (`HARD_BOUNCE`, `SOFT_BOUNCE_REPEATED`, `COMPLAINT`, `MANUAL`).

Helpers in `lib/suppression.ts`:
- `isSuppressed(email)` — soft-bounce rows below threshold are tracked but not blocking.
- `suppress({ email, reason, eventType, rawPayload? })` — hard suppress (upsert).
- `unsuppress(email)` — sets `removedAt`; row stays for audit trail.
- `recordSoftBounce(email, ...)` — increments counter; auto-suppresses at threshold (default 5).

### A.3 SES → SNS webhook (`app/api/webhooks/ses/route.ts`) ✅
- Validates SNS message signature (via `sns-validator`; skipped in non-production).
- Auto-confirms `SubscriptionConfirmation` by fetching `SubscribeURL`.
- `Bounce:Permanent` → `suppress(..., HARD_BOUNCE)`.
- `Bounce:Transient` → `recordSoftBounce(...)`.
- `Complaint` → `suppress(..., COMPLAINT)`.
- Asserts expected `SES_SNS_TOPIC_ARN` when set.

### A.4 Email validation (`lib/email-validation.ts` + `lib/email-suggestions.ts`) ✅
- Pure client-safe typo suggestion in `lib/email-suggestions.ts` (Levenshtein ≤ 2, common domains list).
- Full server-side pipeline in `lib/email-validation.ts`:
  1. RFC 5322 syntax check.
  2. Domain typo suggestion → returns `suggestion` field (UI can show "Did you mean…?").
  3. MX record lookup via `node:dns/promises` with 24 h in-process cache.
  4. Suppression advisory (soft warning — admin can override).
- Integrated into `/admin/users/new` form (client-side live hint) and `POST /api/users` (server-side hard block on MX failure).

### A.5 Infrastructure setup (manual, one-time)
- [ ] Create SNS topic `ledokol-ses-events`.
- [ ] In SES → Configuration Sets: add SNS event destination for Bounce + Complaint.
- [ ] Subscribe SNS topic to `https://<domain>/api/webhooks/ses`.
- [ ] Enable SES account-level suppression: `aws ses put-account-suppression-attributes --suppressed-reasons BOUNCE COMPLAINT`.
- [ ] Set `SES_SNS_TOPIC_ARN` env var.

### Phase A checklist
- [x] `lib/mail.ts` — SES client with suppression pre-check
- [x] `lib/suppression.ts` — isSuppressed / suppress / unsuppress / recordSoftBounce
- [x] `prisma/schema.prisma` — `SuppressedEmail` model, `SuppressionReason` enum
- [x] `app/api/webhooks/ses/route.ts` — SNS webhook
- [x] `lib/email-validation.ts` — server-side MX + suppression validation
- [x] `lib/email-suggestions.ts` — client-safe typo correction
- [x] `/admin/users/new` form — live typo hint
- [x] `POST /api/users` — server-side email validation before user creation
- [x] `.env.example` — SES env vars documented
- [ ] Infrastructure setup (SNS topic, SES config set, subscription — manual)
- [ ] Admin suppression UI at `/admin/settings/email-suppressions` (Phase E)

---

## Phase B — Passwordless Login (6-digit OTP) ✅ DONE

**Goal:** Replace credential-based login with email OTP. Google SSO remains as the fast path.

### B.1 Schema additions ✅
- `EmailLoginCode` model: userId FK, bcrypt codeHash, expiresAt, attemptCount, consumedAt, ipAddress, userAgent. Indexed on (userId, consumedAt) + expiresAt.
- `RateLimitEntry` model: key, windowEnd, count. Unique on (key, windowEnd). Opportunistically pruned on each send-code request.
- `User.passwordHash` made nullable (`String?`) — safe change, no data loss.

### B.2 Rate limiting (persistent, survives restarts) ✅ — **G6 mitigated**
- DB-backed sliding-window counter in `lib/rate-limit.ts`.
- Per-email: 5 send-code requests / hour; 60 s resend cooldown enforced server-side.
- Per-IP: 20 send-code requests / hour.
- `pruneExpired()` called opportunistically on each request (fire-and-forget).

### B.3 Endpoints ✅
- `POST /api/auth/send-code` — syntax-only email validation, rate limits, suppression check, 60 s cooldown, generates 6-digit code, bcrypt-hashes (cost 10), invalidates prior codes, sends via `lib/mail.ts`. Always returns `{ ok: true, retryInSeconds: 60 }` (prevents email enumeration). 429 on rate-limit breach.
- Verify step handled by NextAuth Credentials `authorize()` in `lib/auth.ts` — code compared via bcrypt, attemptCount capped at 5 (auto-consumes on breach).
- `GET /api/auth/csrf-token` — issues double-submit CSRF cookie + returns token.

### B.4 CSRF protection ✅ — **G1 mitigated**
- Double-submit cookie pattern: `GET /api/auth/csrf-token` sets non-httpOnly `ledokol.csrf` cookie (SameSite=Strict) and returns token as JSON.
- `POST /api/auth/send-code` validates `x-csrf-token` header matches cookie value.
- NextAuth's built-in CSRF covers the `signIn('credentials', ...)` verify step.

### B.5 Login page UI ✅
- Two-view component (`view: 'email' | 'code'`) in `app/[locale]/login/login-form.tsx`.
- Email view: email input + "Send code" primary button + Google button (when configured).
- Code view: numeric 6-digit input, 60 s cooldown with resend button, "Use a different email" escape hatch.
- Password field removed entirely.

### B.6 Email template ✅
- `lib/email-templates/login-code.ts` — `renderLoginCodeEmail({ code, locale })`.
- All three locales (RU/EN/UZ). Plain-text + HTML. Code displayed large and centered with brand header.

### B.7 Session ✅
- `session: { strategy: 'jwt', maxAge: 24 * 60 * 60 }` enforced in NextAuth config.

### Phase B checklist
- [x] `EmailLoginCode` + `RateLimitEntry` models in schema; `User.passwordHash` nullable
- [x] Persistent rate limiter (DB-backed) — `lib/rate-limit.ts`
- [x] `POST /api/auth/send-code` with suppression pre-check + rate limits
- [x] CSRF protection — double-submit cookie (`GET /api/auth/csrf-token`)
- [x] NextAuth Credentials `authorize()` rewritten to accept `{ email, code }`
- [x] Login page UI rework (email + code two-view layout)
- [x] Login-code email template (RU/EN/UZ)
- [x] Locale keys added to ru.json, en.json, uz.json
- [x] `session.maxAge` set to 86400 s

---

## Phase C — Magic Link Activation (passwordless invite) ✅ DONE

**Goal:** Admin invites user → user activates via a clickable link, not a password. Then must link Google.

### C.1 Schema additions ✅
- `UserStatus` enum: `INVITED | ACTIVE | DISABLED`.
- `User.status UserStatus @default(ACTIVE)` — safe addition; all existing rows default to ACTIVE.
- `ActivationToken` model: userId `@unique` (one token per user), tokenHash (bcrypt cost 10), expiresAt (7 days), consumedAt. Indexed on expiresAt.
- `User.passwordHash` already made nullable in Phase B.
- `User.activationToken ActivationToken?` relation.

### C.2 Activation flow ✅
1. Admin creates user → `POST /api/users` → no password required → `status = INVITED` → `issueActivationToken(userId)` → `renderActivationEmail` + `sendEmail`. Invite sent flag in API response.
2. Magic link URL: `/{locale}/activate?token=<userId>.<base64url-rawToken>`.
3. Activation page (server component) validates token via `peekActivationToken` (no consumption on load).
4. User clicks "Link Google account" → Server Action: `consumeActivationToken` (marks consumed) → sets `activation-session` cookie (15 min, httpOnly, SameSite=lax) → redirects to Google OAuth via NextAuth.
5. Google OAuth completes → `/{locale}/activate/complete` server component reads cookie + session → verifies email match → sets `status = ACTIVE` → clears cookie → redirects to dashboard.

Token validation rules:
- Not found / bcrypt mismatch → "invalid".
- Consumed → "has already been used — contact admin".
- Expired → "expired — contact admin for a new one".
- User not INVITED (already ACTIVE) → "already activated".

### C.3 Admin "Resend activation" ✅
- Status badge shown on `/admin/users/[id]` with "Повторить приглашение" button when status=INVITED.
- `POST /api/admin/users/[id]/resend-activation` — upserts ActivationToken (rotates token + resets expiry), resends email. Returns 400 if user is not INVITED, 422 if email is suppressed.

### C.4 Existing user migration ✅ — `scripts/migrate-existing-users-phase-c.ts`
- Run: `npx tsx scripts/migrate-existing-users-phase-c.ts`
- Finds all users where `passwordHash IS NOT NULL`.
- Confirms `status = ACTIVE` for each (skips INVITED/DISABLED).
- **Result: 4 users confirmed ACTIVE (admin@ledokol.uz, client@tbank.uz, client@tbc.uz, client@laimon.uz).**
- `passwordHash` column NOT dropped — deferred to Phase D (safer rollback posture until new flow is verified in production).

### Phase C checklist
- [x] `UserStatus` enum + `User.status` field in schema
- [x] `ActivationToken` model in schema
- [x] `lib/activation.ts` — `issueActivationToken`, `peekActivationToken`, `consumeActivationToken`, `buildActivationUrl`
- [x] `lib/email-templates/activation.ts` — RU/EN/UZ, text + HTML
- [x] `POST /api/users` — password removed, auto-issues token + sends email, returns `inviteSent`
- [x] `POST /api/admin/users/[id]/resend-activation` — admin only, INVITED users only
- [x] `app/[locale]/activate/page.tsx` — server component + server action for Google link
- [x] `app/[locale]/activate/complete/page.tsx` — verifies email match, sets ACTIVE, redirects
- [x] `components/admin/user-form.tsx` — password field removed, status badge, resend button
- [x] `GET /api/users/[id]` and `PUT /api/users/[id]` — `status` field included
- [x] Migration script ran — 4 users confirmed ACTIVE, 0 skipped
- [ ] Drop `passwordHash` column — deferred to Phase D (do NOT drop until new flow verified in production)
- [ ] Remove password field from `/admin/users/new` form

---

## Phase D — Session Hardening

**Goal:** Enforce 24 h session lifetime with explicit re-verification.

### D.1 JWT expiry
- Set `session: { strategy: 'jwt', maxAge: 24 * 60 * 60 }` in NextAuth config.
- After expiry, user lands on login page → re-verifies via OTP or Google.

### D.2 Re-verify UX
- Middleware detects expired session → redirects to login with `?reason=session_expired`.
- Login page shows a contextual message: "Your session expired. Sign in again."
- No partial-session or "remember me" complexity — just a clean 24 h window.

### D.3 Drop `passwordHash` column
- Remove `User.passwordHash` after the new OTP/magic-link flow is verified in production. Deferred from Phase C for a safer rollback posture.
- Safe to drop once: no active sessions are using password-based auth, and all users have completed activation.

### D.4 Drop `enabled` column
- Remove `User.enabled` after all code references are migrated to `UserStatus`.

### Phase D checklist
- [ ] `maxAge: 86400` set in NextAuth session config
- [ ] Middleware expired-session detection + contextual redirect
- [ ] Login page `?reason=session_expired` message
- [ ] `User.enabled` column removed (after Phase C migration confirmed stable)

---

## Phase E — Admin Tools

**Goal:** Give admins visibility and control over the auth system.

### E.1 Suppression management UI (`/admin/settings/email-suppressions`)
- Table: email, reason, suppressed at, removed at.
- "Remove suppression" button → `DELETE /api/admin/email-suppressions/[id]` → sets `removedAt`.
- Filter by reason, date range.

### E.2 Account recovery (lost Google access)
- Admin button on `/admin/users/[id]`: "Reset to invited".
- Clears `inviteTokenHash`, regenerates token, sends fresh magic link.
- User goes through activation flow again and links a new Google account.
- No self-service recovery path — admin-mediated only.

### E.3 Resend activation (from Phase C)
Already described in Phase C.3 — included here for completeness.

### Phase E checklist
- [ ] Suppression management page + remove-suppression API
- [ ] "Reset to invited" admin action
- [ ] Audit log for admin auth actions (optional but useful)

---

## Gaps & open questions

| # | Gap | Status |
|---|-----|--------|
| G1 | **CSRF protection** on `POST /api/auth/send-code` and `POST /api/auth/verify-code`. NextAuth handles CSRF for its own endpoints; the custom code endpoints need it too. Options: double-submit cookie, or rely on `SameSite=Strict` cookie + `Origin` header check. | ✅ Mitigated — double-submit cookie via `GET /api/auth/csrf-token` + `x-csrf-token` header check on send-code. NextAuth built-in CSRF covers the verify step. |
| G2 | **Session re-verify after 24 h**: no in-app "your session is about to expire" warning. Users will be dropped to login without warning. Acceptable for now. | Accepted |
| G3 | **Suppression list blocks OTP delivery**: user can't log in if their email is suppressed. Admin must un-suppress manually before user can receive a code. No self-service path. | Accepted — admin intervention documented in Phase E |
| G4 | **Account recovery if Google account is lost**: covered by Phase E.2 (admin resets to INVITED). | Planned — Phase E |
| G5 | **`enabled` boolean vs `UserStatus`**: currently both exist. `enabled` takes precedence in `authorize` callback. Phase C migration must keep them in sync until Phase D removes `enabled`. | Planned — Phase C/D |
| G6 | **Rate limiter resets on cold start**: current in-memory map in `lib/api-auth.ts` loses state. Must be replaced with DB-backed limiter before Phase B ships. | ✅ Mitigated — `lib/rate-limit.ts` is DB-backed via `RateLimitEntry`, survives restarts. |
| G7 | **MX cache is in-process**: fine for single-container Docker; loses cache on restart. Not a correctness issue, just a performance/cost note. | Accepted |
| G8 | **Magic link vs OTP for activation**: activation uses a link (better UX — one click), login uses a code (safer — avoids email-client prefetch following the link and consuming it). This distinction is intentional. | Decided |

---

## DB migration sketch (Phase C)

```sql
-- Safe: nullable passwordHash
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- New enum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');

-- New columns on User
ALTER TABLE "User"
  ADD COLUMN "status"             "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "inviteTokenHash"    TEXT,
  ADD COLUMN "inviteTokenExpiry"  TIMESTAMPTZ;

-- Data migration: enabled=false → DISABLED
UPDATE "User" SET status = 'DISABLED' WHERE enabled = false;

-- Phase B OTP table
CREATE TABLE "LoginOtp" (
  "id"        TEXT        PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"     TEXT        NOT NULL,
  "codeHash"  TEXT        NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt"    TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "LoginOtp_email_idx" ON "LoginOtp"("email");
CREATE INDEX "LoginOtp_expiresAt_idx" ON "LoginOtp"("expiresAt");
```

---

*This document is a living roadmap. Update phase status and open questions as decisions are made.*
