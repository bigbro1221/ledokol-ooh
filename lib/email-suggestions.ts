/**
 * Pure client-safe email typo detection — no Node.js APIs, no DB.
 * Safe to import in client components.
 */

export const KNOWN_DOMAINS = [
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
  'icloud.com', 'proton.me', 'protonmail.com', 'yandex.ru', 'yandex.com',
  'mail.ru', 'mail.uz', 'bk.ru', 'list.ru', 'inbox.ru',
] as const;

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function suggestDomain(domain: string): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const known of KNOWN_DOMAINS) {
    const dist = levenshtein(domain, known);
    if (dist < bestDist && dist <= 2) {
      bestDist = dist;
      best = known;
    }
  }
  return best;
}

/** Returns a corrected email address if the domain looks like a typo, or null. */
export function suggestEmailCorrection(email: string): string | null {
  if (!email.includes('@')) return null;
  const atIdx = email.lastIndexOf('@');
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1).toLowerCase();
  if ((KNOWN_DOMAINS as readonly string[]).includes(domain)) return null;
  const suggestion = suggestDomain(domain);
  return suggestion ? `${local}@${suggestion}` : null;
}
