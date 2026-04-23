'use client';

import { usePathname, useRouter } from 'next/navigation';

const LOCALES = [
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
  { code: 'uz', label: 'UZ' },
] as const;

export function LocaleSwitcher({ currentLocale }: { currentLocale: string }) {
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(newLocale: string) {
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  }

  return (
    <div className="flex items-center gap-0.5">
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          className={`rounded px-2 py-1 text-[12px] font-medium transition-colors ${
            currentLocale === code
              ? 'bg-[var(--brand-primary-subtle)] text-[var(--brand-primary)]'
              : 'text-[var(--text-3)] hover:text-[var(--text)]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
