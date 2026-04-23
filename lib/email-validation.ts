import { resolveMx } from 'node:dns/promises';
import { isSuppressed } from '@/lib/suppression';
import { KNOWN_DOMAINS, suggestDomain } from '@/lib/email-suggestions';

// In-memory MX cache: domain → { valid, cachedAt }
const mxCache = new Map<string, { valid: boolean; cachedAt: number }>();
const MX_TTL_MS = 24 * 60 * 60 * 1000;

export interface EmailValidationResult {
  ok: boolean;
  reason?: string;
  suggestion?: string;
}

async function hasMxRecords(domain: string): Promise<boolean> {
  const cached = mxCache.get(domain);
  if (cached && Date.now() - cached.cachedAt < MX_TTL_MS) return cached.valid;
  try {
    const records = await resolveMx(domain);
    const valid = records.length > 0;
    mxCache.set(domain, { valid, cachedAt: Date.now() });
    return valid;
  } catch {
    mxCache.set(domain, { valid: false, cachedAt: Date.now() });
    return false;
  }
}

/**
 * Full server-side email validation pipeline:
 *   1. RFC 5322 syntax check
 *   2. Typo-correction suggestion (Levenshtein ≤ 2 against known domains)
 *   3. MX record lookup (with 24h in-process cache)
 *   4. Suppression list advisory check
 *
 * Returns { ok: false } to hard-block, or { ok: true, suggestion } for
 * typo hints, or { ok: true, reason } for soft-advisory suppression warnings.
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  // 1. Syntax
  const syntaxOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if (!syntaxOk) return { ok: false, reason: 'Invalid email format' };

  const atIdx = email.lastIndexOf('@');
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1).toLowerCase();

  // 2. Typo suggestion (only when domain is not already a known good one)
  if (!(KNOWN_DOMAINS as readonly string[]).includes(domain)) {
    const suggestion = suggestDomain(domain);
    if (suggestion) {
      // Return ok:true with suggestion so the UI can surface "Did you mean…?"
      // The caller decides whether to block or just warn.
      return { ok: true, suggestion: `${local}@${suggestion}` };
    }
  }

  // 3. MX lookup
  const mxOk = await hasMxRecords(domain);
  if (!mxOk) {
    return { ok: false, reason: `Domain ${domain} does not accept email (no MX records)` };
  }

  // 4. Suppression advisory (soft warning — caller can override)
  const suppressed = await isSuppressed(email);
  if (suppressed) {
    return {
      ok: true,
      reason: 'This address previously failed delivery — confirm before sending?',
    };
  }

  return { ok: true };
}

