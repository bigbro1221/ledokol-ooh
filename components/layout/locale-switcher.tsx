'use client';

import { usePathname, useRouter } from 'next/navigation';

const LOCALES = ['ru', 'en', 'uz'] as const;
const LABELS: Record<string, string> = { ru: 'RU', en: 'EN', uz: 'UZ' };

export function LocaleSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = LOCALES.find(l => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? 'ru';

  function setLocale(next: typeof LOCALES[number]) {
    if (next === currentLocale) return;
    router.push(pathname.replace(`/${currentLocale}`, `/${next}`));
  }

  return (
    <>
      {/* Mobile: single button that cycles through locales */}
      <button
        type="button"
        onClick={() => {
          const next = LOCALES[(LOCALES.indexOf(currentLocale) + 1) % LOCALES.length];
          setLocale(next);
        }}
        aria-label={`Current locale ${currentLocale.toUpperCase()}; click to change`}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[11px] font-semibold tracking-wide text-[var(--text-2)] transition-colors hover:border-[var(--border-hi)] hover:bg-[var(--surface-2)] sm:hidden"
      >
        {LABELS[currentLocale]}
      </button>

      {/* Desktop: segmented pill */}
      <div className="hidden h-8 items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-0.5 sm:inline-flex">
        {LOCALES.map(l => {
          const active = l === currentLocale;
          return (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              aria-label={`Switch to ${l.toUpperCase()}`}
              className={`flex h-[26px] min-w-[30px] items-center justify-center rounded-full px-2 text-[11px] font-semibold tracking-wide transition-colors ${
                active
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'text-[var(--text-3)] hover:text-[var(--text)]'
              }`}
            >
              {LABELS[l]}
            </button>
          );
        })}
      </div>
    </>
  );
}
