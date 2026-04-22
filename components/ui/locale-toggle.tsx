'use client';

import { usePathname, useRouter } from 'next/navigation';

const LOCALES = ['ru', 'uz', 'en'] as const;
const LABELS: Record<string, string> = { ru: 'RU', uz: "O'Z", en: 'EN' };

export function LocaleToggle() {
  const pathname = usePathname();
  const router = useRouter();

  const currentLocale = LOCALES.find(l => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? 'ru';
  const nextLocale = LOCALES[(LOCALES.indexOf(currentLocale) + 1) % LOCALES.length];

  const handleToggle = () => {
    router.push(pathname.replace(`/${currentLocale}`, `/${nextLocale}`));
  };

  return (
    <button
      onClick={handleToggle}
      aria-label={`Switch to ${nextLocale}`}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[11px] font-semibold tracking-wide text-[var(--text-2)] transition-all duration-[var(--duration-fast)] hover:border-[var(--border-hi)] hover:bg-[var(--surface-2)]"
    >
      {LABELS[currentLocale]}
    </button>
  );
}
