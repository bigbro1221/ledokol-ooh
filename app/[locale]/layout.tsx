import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/lib/i18n';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { SessionProvider } from '@/components/ui/session-provider';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'OOH Dashboard — Ledokol Group',
  description: 'Outdoor advertising dashboard for Ledokol Group',
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body
        className="min-h-screen bg-[var(--bg)] font-sans antialiased"
        style={{ fontFamily: 'var(--font-geist-sans, -apple-system, BlinkMacSystemFont, sans-serif)' }}
      >
        <ThemeProvider>
          <SessionProvider>
            <NextIntlClientProvider messages={messages}>
              {children}
            </NextIntlClientProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
