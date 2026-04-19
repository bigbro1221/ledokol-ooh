# Auth Roadmap — Ledokol OOH Dashboard

> **Owner:** Beck Rakhimov  
> **Last updated:** 2026-04-19  
> **Stack:** Next.js 14 · TypeScript · Prisma 6 · PostgreSQL · NextAuth 5 (beta)

---

## Phase 0 — Current State Audit

### What exists

| Area | Detail |
|------|--------|
| Auth library | NextAuth 5.0.0-beta.25, Credentials provider only |
| Session | Stateless JWT (no server-side session store) |
| Password | bcryptjs (cost 12), stored as `passwordHash` on `User` |
| User creation | Admin fills a form at `/admin/users/new` and sets the password on behalf of the user |
| Role model | Two roles: `ADMIN`, `CLIENT` (enforced in middleware + `requireAdmin()` helper) |
| Account disable | `enabled` boolean on `User`; disabled users are rejected at the `authorize` callback |
| Rate limiting | In-memory map in `lib/api-auth.ts` — 10 attempts per 60 s per key; resets on server restart |

### What is broken / missing

1. **Admin sets the user's password.** This means the password is shared over some out-of-band channel (Slack, email) in plaintext. The user never "owns" their credential from day one.
2. **No invite or email verification.** The system has no concept of a pending/unverified user, no token infrastructure, and no email-sending capability at all.
3. **No self-service password reset.** A forgotten password requires admin intervention.
4. **No 2FA.** The only factor is a password the user may not have even chosen.
5. **Rate limiter is in-memory only.** It resets on every Next.js cold start / serverless invocation, giving essentially no protection in production.
6. **`passwordHash` is non-nullable.** Invite flow requires a password-less "pending" state, which is impossible with the current schema.

---

## Phase 1 — MVP (Invite Flow + Optional 2FA + Google SSO)

**Goal:** Users choose their own password from day one; 2FA is available but not forced; admins never handle plaintext credentials.

### Deliverables

#### 1.1 Schema changes (Prisma + PostgreSQL)

New/modified models — see the [DB Migration Sketch](#db-migration-sketch) section at the bottom for exact SQL/Prisma.

- `User.passwordHash` → nullable (no password until invite is accepted)
- `User.status` → new `UserStatus` enum: `INVITED | ACTIVE | DISABLED`
- `User.inviteTokenHash` → SHA-256 hash of the raw one-time token (never stored raw)
- `User.inviteTokenExpiry` → 7-day window from invite send
- `User.googleId` → nullable, unique (links Google OAuth account)
- New model `TotpCredential` → per-user TOTP secret + verified-at timestamp
- New model `RecoveryCode` → bcrypt-hashed single-use backup codes (8 per enrollment)
- New model `AppSettings` → single-row config table; seeded with `twoFactorRequired = false`
- New model `SuppressedEmail` → tracks email addresses that must not receive transactional mail (reason, event type, soft bounce count)

#### 1.2 Email infrastructure

No email provider is currently installed. Recommend **Resend** (`resend` npm package) — it is Next.js-native, has a generous free tier, and requires minimal config. Fall-back option: Nodemailer + SMTP (works with any provider).

Required env vars: `RESEND_API_KEY`, `EMAIL_FROM`.

Templates needed:
- Invite / welcome (includes one-time link, 7-day expiry notice)
- Re-invite / resend (same template, new token)
- (Phase 2+) Recovery code used warning, new device sign-in notice

#### 1.3 SES bounce and complaint handling

**Why this must ship in Phase 1, not later:** SES tracks your sending reputation continuously. Every hard bounce and complaint counts against your account. The penalty is not immediate — invites will appear to send fine for weeks — but then bulk deliverability degrades silently: invites start landing in spam, and eventually SES throttles or suspends the account. By the time the symptoms are obvious, the damage to reputation is already done. The fix must be in place before the first invite email goes out.

**Architecture overview:**

SES publishes bounce and complaint notifications to an SNS topic. Two viable subscriber options:

1. **SNS → HTTPS webhook** (recommended for this stack) — SNS POSTs to `POST /api/webhooks/ses` directly. Zero infrastructure beyond deploying the route. Works well at low-to-medium invite volumes.
2. **SNS → SQS → worker** — better if you want retry guarantees or expect high volume. Adds an SQS queue and a polling consumer (a separate process or Lambda). Overkill for Phase 1.

**Infrastructure setup (one-time):**
- Create an SNS topic (e.g., `ledokol-ses-events`).
- In SES → Configuration Sets, create a configuration set and add an SNS event destination publishing `Bounce` and `Complaint` notification types.
- Subscribe the SNS topic to `https://<your-domain>/api/webhooks/ses`. SNS will send a `SubscriptionConfirmation` request first — the handler must respond by fetching the `SubscribeURL` to activate the subscription.
- Attach the configuration set to every `SendEmail` call (`ConfigurationSetName` parameter).

**Webhook handler — `POST /api/webhooks/ses`:**

The handler must:
1. Verify the SNS message signature (AWS publishes the signing cert URL in the message; use `@aws-sdk/sns-message-validator` or verify manually). **Do not skip this — unauthenticated webhook endpoints are a common attack vector.**
2. Handle `Type: SubscriptionConfirmation` by GET-fetching `SubscribeURL`.
3. Handle `Type: Notification` — parse the nested `Message` field (JSON string within JSON):
   - `notificationType: "Bounce"` → extract `bounce.bounceType` (`Permanent` or `Transient`), `bounce.bounceSubType`, and `bounce.bouncedRecipients[].emailAddress`.
   - `notificationType: "Complaint"` → extract `complaint.complainedRecipients[].emailAddress`.

**Suppression logic:**

| Event | Action |
|-------|--------|
| Hard bounce (`bounceType: Permanent`) | Immediately upsert into `SuppressedEmail` with `reason: HARD_BOUNCE` |
| Complaint | Immediately upsert into `SuppressedEmail` with `reason: COMPLAINT` |
| Soft bounce (`bounceType: Transient`) | Increment `softBounceCount` on `SuppressedEmail` (upsert); suppress (set `suppressedAt`) once count reaches threshold (recommended: 5 consecutive) |

The `SuppressedEmail` table is described in the [DB Migration Sketch](#db-migration-sketch) below.

**Pre-send check:**

Every function that calls the email provider must check the suppression table first:

```typescript
// lib/email.ts
async function isSuppressed(email: string): Promise<boolean> {
  const row = await prisma.suppressedEmail.findUnique({
    where: { email },
    select: { suppressedAt: true },
  });
  return row?.suppressedAt != null;
}
```

If suppressed: log the skip and return without sending. Do not throw — the calling code (e.g. "resend invite" button) should receive a clear API response indicating the address is suppressed, so the admin knows to un-suppress or update the email before retrying.

**SES account-level suppression (belt-and-suspenders):**

Call `PutAccountSuppressionAttributes` once during infrastructure setup to enable SES's own suppression list for hard bounces and complaints:

```bash
aws ses put-account-suppression-attributes \
  --suppressed-reasons BOUNCE COMPLAINT
```

This causes SES to automatically refuse to send to addresses it has previously recorded as hard-bounced or complained against, even if our application-level check misses something (e.g. a race condition or a missed webhook delivery).

**Admin suppression management UI:**

A page at `/admin/settings/email-suppressions` (or a tab within `/admin/users`) showing:

- Table columns: email, linked user account (if any), reason, event type, soft bounce count, suppressed at.
- **"Remove suppression" button** per row → calls `DELETE /api/admin/email-suppressions/[id]` → records `unsuppressedAt` and the admin `userId` who cleared it (do not hard-delete — keep the audit trail).
- **Filter by reason** (HARD_BOUNCE / COMPLAINT / SOFT_BOUNCE_THRESHOLD) and by date range.
- Useful for: admin invited a user with a typo in the email → fixed the email → needs to clear the suppression before resending the invite.

**Open questions specific to 1.3:**
- [ ] SNS message signature verification library — `@aws-sdk/sns-message-validator` vs manual verification
- [ ] Soft bounce threshold — 5 is a common default; should it be configurable via `AppSettings`?
- [ ] Should removing a suppression also automatically trigger a resend of the pending invite, or require a separate admin action?
- [ ] Alert on complaint rate spike — SES has a CloudWatch metric `Reputation.ComplaintRate`; set an alarm at > 0.1 % (SES's own warning threshold)

#### 1.4 Invite flow — admin side

- Remove the `password` field from the Create User form.
- `POST /api/users` no longer accepts `password`. Instead:
  1. Generate `crypto.randomBytes(32)` → raw token
  2. Store `SHA-256(token)` as `inviteTokenHash`, `now() + 7 days` as `inviteTokenExpiry`, `status = INVITED`
  3. Send invite email with link: `/invite/accept?token=<rawToken>`
- Add a "Resend invite" button on the user list/edit page → calls `POST /api/users/[id]/resend-invite` → rotates token, resets expiry, resends email.
- Status column on the user list should show `INVITED | ACTIVE | DISABLED`.

#### 1.5 Invite acceptance — user side

New pages:
- `/invite/accept?token=…` — validates token (hash lookup, expiry check, status=INVITED), then shows a set-password form.
- On submit: hash password, set `passwordHash`, flip `status → ACTIVE`, clear `inviteTokenHash` / `inviteTokenExpiry`.
- Immediately sign the user in and redirect to the 2FA advisory screen (1.5).

Token validation rules:
- Token not found → generic "link is invalid or expired" error (don't leak which).
- Token found but expired → show "link expired, request a new one" with a mailto/contact link.
- Token found, valid, but `status != INVITED` → "account already activated, go to login".

#### 1.6 Post-invite 2FA advisory screen

Shown once, immediately after the user sets their password. Not shown again unless they visit Settings.

Three options:
- **Enable 2FA now** → TOTP enrollment flow (1.6) or Google SSO link (1.7)
- **Remind me later** → session cookie / user preference; shown again next login for N days (suggested: 7)
- **Skip for now** → dismisses permanently until admin forces it (Phase 2)

Middleware must not enforce 2FA at this stage — `AppSettings.twoFactorRequired = false` is the gate.

#### 1.7 TOTP enrollment

Library: `otpauth` (maintained, browser + Node, no native deps).

Flow:
1. Server generates a TOTP secret (`OTPAuth.Secret.generate()`), stores it as `TotpCredential` with `verifiedAt = NULL` (unverified).
2. Render QR code (client-side via `qrcode` package) and the plain-text secret for manual entry.
3. User enters a 6-digit code. Server verifies with a ±1 step window to tolerate clock skew.
4. On success: set `verifiedAt = now()`, generate 8 recovery codes (`crypto.randomBytes(5).toString('hex')`), store bcrypt hashes in `RecoveryCode`, display the plaintext codes **once** with a download/copy prompt.
5. Codes are displayed with a clear warning: "These codes will not be shown again."

#### 1.8 Google SSO

NextAuth already supports the Google provider — wire it up with env vars `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

Behavior:
- Google sign-in is an **alternative login path** (not a replacement).
- On first Google sign-in: look up `User` by `googleId` OR by email. If found by email (existing account), link the Google ID. If not found at all, deny (this is not a public sign-up app — only invited users can log in).
- After linking, the user can sign in with either Google or password+TOTP.

Open question: Should linking Google auto-satisfy 2FA? Recommended: yes for the advisory screen, but TOTP enrollment should remain independent if the org later requires TOTP specifically.

#### 1.9 TOTP at login

Modified `authorize` callback:
1. Validate email + password as today.
2. Check if `TotpCredential` exists and `verifiedAt IS NOT NULL`.
3. If yes: return a partial token (`totpRequired: true`) and redirect to a `/auth/totp` challenge page before issuing a full session.
4. On the challenge page: verify the submitted code; if valid, exchange partial token for a full session.

Implementation note: NextAuth 5 (beta) handles this cleanly with a custom `signIn` callback and a separate challenge route. Alternatively, a short-lived encrypted cookie can carry the partial state.

#### 1.10 Recovery code flow

On the TOTP challenge page: "Lost your authenticator?" link.
- User pastes one of their recovery codes.
- Server looks up `RecoveryCode` by `userId` + bcrypt verify, where `usedAt IS NULL`.
- If valid: mark code `usedAt = now()`, sign the user in, then **immediately redirect to forced TOTP re-enrollment** (not optional this time).
- Issue 8 fresh recovery codes on successful re-enrollment.

#### 1.11 AppSettings read in middleware

`middleware.ts` must call a lightweight DB read (or cache) for `AppSettings.twoFactorRequired`. When `false` (Phase 1), enrollment is advisory only and the middleware never blocks. When `true` (Phase 2), users without a verified `TotpCredential` are gated at the middleware level.

Caching strategy for middleware: since Next.js middleware runs on the edge (or Node runtime depending on config), use a short in-memory cache (60 s TTL) or a Redis-backed cache if latency matters.

### Phase 1 implementation checklist

- [ ] Schema migration: `UserStatus` enum, nullable `passwordHash`, invite token fields, `googleId` on `User`
- [ ] New models: `TotpCredential`, `RecoveryCode`, `AppSettings`
- [ ] **`SuppressedEmail` table and pre-send check** in every email-sending path
- [ ] Email provider wired up (SES or Resend) with configuration set attached to all sends
- [ ] **SNS topic + webhook subscriber** at `POST /api/webhooks/ses` with signature verification
- [ ] Bounce/complaint handler: hard bounce → suppress, complaint → suppress, soft bounce → count → suppress at threshold
- [ ] SES account-level suppression enabled via `PutAccountSuppressionAttributes`
- [ ] **Admin suppression management UI** at `/admin/settings/email-suppressions`
- [ ] Invite flow: admin creates user → invite email sent, status = INVITED
- [ ] Invite acceptance page: token validation, password set, status → ACTIVE
- [ ] 2FA advisory screen post-invite (Enable now / Remind me later / Skip)
- [ ] TOTP enrollment with QR code and recovery code issuance
- [ ] Google SSO wired up as alternative login path
- [ ] TOTP challenge at login for enrolled users
- [ ] Recovery code flow with forced re-enrollment on use
- [ ] `AppSettings.twoFactorRequired` read in middleware (advisory only while `false`)
- [ ] All new UI strings added to `/messages/*.json` (RU/EN/UZ/TR)

### Open questions for Phase 1

- [ ] Email provider choice — Resend vs Nodemailer vs AWS SES (S3 is already on AWS; SES would be zero new vendors)
- [ ] TOTP window tolerance — ±1 step (30 s each = ±30 s) is standard; should it be tighter?
- [ ] Partial-session approach for 2FA challenge — NextAuth 5 beta internals are still shifting; may need a workaround
- [ ] Should Google SSO count as satisfying TOTP when `twoFactorRequired` flips in Phase 2?
- [ ] Recovery code length/format — 10 hex chars (5 bytes) = ~10^12 space; is that enough? Standard is usually 16 base-32 chars
- [ ] Localization — invite emails and all new screens need RU/EN/UZ/TR strings in `/messages/*.json`

---

## Phase 2 — Post-launch: Enforce 2FA + Admin Reporting

**Trigger:** Decision to flip `AppSettings.twoFactorRequired = true`.

### Deliverables

- **Grandfather period.** At flip time, existing users who have not enrolled get a grace period (recommended: 14 days). Store `gracePeriodUntil DateTime?` on `TotpCredential` (or on `User`). Middleware allows login but immediately redirects to enrollment until the grace period expires.
- **Hard gate after grace period.** After `gracePeriodUntil`, users without a verified TOTP cannot proceed past middleware — they see a mandatory enrollment screen with no "skip" option.
- **Admin dashboard widget.** At `/admin/settings` or `/admin/users`: table showing enrollment rate (verified/total), breakdown by role, list of users still in grace period with days remaining.
- **Admin force-re-enrollment.** Button to invalidate a user's TOTP secret (e.g., lost device, suspected compromise) — deletes `TotpCredential` and `RecoveryCode` rows, sets a flag requiring re-enrollment on next login.
- **Audit log entries** for: 2FA enabled, 2FA disabled by admin, recovery code used, grace period expiry.

### Open questions

- [ ] Grace period duration — 14 days? configurable via another `AppSettings` field?
- [ ] Notification strategy — email users before grace period expires (at D-7, D-1)?
- [ ] What happens to Google-only users when TOTP is required — force TOTP enrollment in addition to Google, or exempt them?

---

## Phase 3 — Hardening

### Deliverables

- **Passkeys / WebAuthn.** Replace TOTP as the preferred second factor. Libraries: `@simplewebauthn/server` + `@simplewebauthn/browser`. New model `Passkey` on `User`. Passkeys can also serve as a first factor (passwordless). NextAuth 5 has native WebAuthn support (experimental in beta).
- **Additional SSO providers.** Microsoft (Azure AD), Apple Sign-In — each requires provider config in NextAuth and potentially `User.microsoftId`, `User.appleId` fields.
- **SCIM provisioning.** If any enterprise clients want to manage users via their IdP (Okta, Azure AD), expose a SCIM 2.0 `/scim/v2/Users` endpoint. This is only relevant for B2B accounts. New `ScimToken` model for bearer auth.
- **Session management UI.** Show active JWT sessions (requires moving from stateless JWT to server-side sessions or a session registry). Allow users to revoke individual sessions. Model: `Session` table with `userId`, `tokenHash`, `userAgent`, `ip`, `lastSeenAt`, `revokedAt`.
- **Stateless → stateful JWT migration.** The current JWT strategy has no revocation path. For session management to work, NextAuth must use the `database` session strategy with a `Session` model in Prisma.

### Open questions

- [ ] Is there a B2B customer who would need SCIM in the near term?
- [ ] Migration path from JWT to database sessions — existing JWT tokens will be invalidated; coordinate a rollout window
- [ ] Apple Sign-In requires a paid Apple Developer account and specific domain verification

---

## Phase 4 — Nice-to-haves

| Feature | Notes |
|---------|-------|
| Risk-based auth | Challenge with TOTP if login IP or device fingerprint is new. Requires storing `lastKnownIp` / `lastKnownDevice` and a challenge decision service. |
| Device fingerprinting | Store `deviceHash` per session (UA + IP subnet + accept-language headers). Flag anomalies. Privacy implications in EU/UZ. |
| Admin auth event log | Immutable append-only table: `AuthEvent { userId, type, ip, userAgent, createdAt }`. Types: LOGIN_SUCCESS, LOGIN_FAILURE, TOTP_VERIFIED, RECOVERY_CODE_USED, INVITE_SENT, PASSWORD_CHANGED, etc. |
| Self-service password change | Authenticated users can change password — current password required, invalidates other sessions. |
| Magic-link login | Alternative to password for users who prefer it. One-time token via email, 10-min expiry. |
| IP allowlisting per client | `Client.allowedIpRanges String[]` — only allow logins for CLIENT users from specified CIDR ranges. |

---

## DB Migration Sketch

This is a planning sketch, not final SQL. Review before applying.

### New enum

```sql
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');
```

### Altered `User` table

```sql
ALTER TABLE "User"
  ADD COLUMN "status"            "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "inviteTokenHash"   TEXT,         -- SHA-256(raw token), never the raw token
  ADD COLUMN "inviteTokenExpiry" TIMESTAMPTZ,
  ADD COLUMN "googleId"          TEXT UNIQUE;

-- Migrate enabled=false → DISABLED; enabled=true stays ACTIVE (default)
UPDATE "User" SET status = 'DISABLED' WHERE enabled = false;

-- Make passwordHash nullable (users in INVITED state have no password yet)
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
```

> **Risk note:** Making `passwordHash` nullable is a safe schema change (no data loss). All existing rows keep their values. The `enabled` column should be kept during Phase 1 and dropped in Phase 2 once all code references are migrated.

### New `TotpCredential` table

```sql
CREATE TABLE "TotpCredential" (
  "id"         TEXT        PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"     TEXT        NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  "secret"     TEXT        NOT NULL,    -- TOTP secret (consider AES encryption at rest)
  "verifiedAt" TIMESTAMPTZ,             -- NULL = enrollment started but not confirmed
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### New `RecoveryCode` table

```sql
CREATE TABLE "RecoveryCode" (
  "id"       TEXT        PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"   TEXT        NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "codeHash" TEXT        NOT NULL,    -- bcrypt(raw code, 10)
  "usedAt"   TIMESTAMPTZ              -- NULL = available; set when consumed
);
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");
```

### New `SuppressedEmail` table

```sql
CREATE TABLE "SuppressedEmail" (
  "id"              TEXT        PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"           TEXT        NOT NULL UNIQUE,
  "reason"          TEXT        NOT NULL,      -- 'HARD_BOUNCE' | 'COMPLAINT' | 'SOFT_BOUNCE_THRESHOLD'
  "eventType"       TEXT        NOT NULL,      -- raw SES notificationType for debugging
  "softBounceCount" INT         NOT NULL DEFAULT 0,
  "suppressedAt"    TIMESTAMPTZ,               -- NULL = being tracked (soft bounce below threshold)
  "unsuppressedAt"  TIMESTAMPTZ,               -- set when admin manually clears
  "unsuppressedBy"  TEXT        REFERENCES "User"(id) ON DELETE SET NULL
);
CREATE INDEX "SuppressedEmail_suppressedAt_idx" ON "SuppressedEmail"("suppressedAt");
```

> **Note:** A row is only "active" (blocks sends) when `suppressedAt IS NOT NULL`. Soft bounce tracking creates the row with `suppressedAt = NULL` and increments `softBounceCount`; once it hits the threshold the row is updated to set `suppressedAt`. This keeps audit history without a separate tracking table.

### New `AppSettings` table

```sql
CREATE TABLE "AppSettings" (
  "id"                INT     PRIMARY KEY DEFAULT 1,  -- single-row sentinel
  "twoFactorRequired" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the single row
INSERT INTO "AppSettings" ("twoFactorRequired") VALUES (false);
```

### Prisma schema additions (for reference)

```prisma
enum UserStatus {
  INVITED
  ACTIVE
  DISABLED
}

// Additions to User model:
//   status            UserStatus     @default(ACTIVE)
//   passwordHash      String?        // was non-nullable
//   inviteTokenHash   String?
//   inviteTokenExpiry DateTime?
//   googleId          String?        @unique
//   totp              TotpCredential?
//   recoveryCodes     RecoveryCode[]

model TotpCredential {
  id         String    @id @default(uuid())
  userId     String    @unique
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  secret     String
  verifiedAt DateTime?
  createdAt  DateTime  @default(now())
}

model RecoveryCode {
  id       String    @id @default(uuid())
  userId   String
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  codeHash String
  usedAt   DateTime?

  @@index([userId])
}

model AppSettings {
  id                Int      @id @default(1)
  twoFactorRequired Boolean  @default(false)
  updatedAt         DateTime @updatedAt
}

model SuppressedEmail {
  id              String    @id @default(uuid())
  email           String    @unique
  reason          String    // 'HARD_BOUNCE' | 'COMPLAINT' | 'SOFT_BOUNCE_THRESHOLD'
  eventType       String    // raw SES notificationType
  softBounceCount Int       @default(0)
  suppressedAt    DateTime? // NULL = tracked but not yet suppressed (soft bounce below threshold)
  unsuppressedAt  DateTime?
  unsuppressedBy  String?   // admin User.id who cleared it
  admin           User?     @relation(fields: [unsuppressedBy], references: [id], onDelete: SetNull)

  @@index([suppressedAt])
}
```

### New npm packages needed (Phase 1)

| Package | Purpose |
|---------|---------|
| `resend` | Transactional email — or omit if using SES directly via `@aws-sdk/client-ses` |
| `@aws-sdk/client-ses` | SES `SendEmail` calls (AWS SDK already in use for S3; SES client is a separate sub-package) |
| `@aws-sdk/sns-message-validator` | Verify SNS message signatures in the webhook handler |
| `otpauth` | TOTP secret generation + code verification |
| `qrcode` | QR code rendering for TOTP enrollment (client-side) |

Google SSO: no new package — NextAuth already includes the Google provider; just needs env vars.

---

*This document is a living roadmap. Update phase status and open questions as decisions are made.*
