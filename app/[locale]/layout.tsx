import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/lib/i18n';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { SessionProvider } from '@/components/ui/session-provider';
import '@/app/globals.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const title = t('title');
  const description = t('description');

  return {
    title,
    description,
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png', media: '(prefers-color-scheme: light)' },
        { url: '/favicon-96x96-dark.png', sizes: '96x96', type: 'image/png', media: '(prefers-color-scheme: dark)' },
        { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '192x192' }],
    },
    openGraph: {
      title,
      description,
      images: [{ url: '/preview.jpg', width: 1200, height: 630, alt: 'Ledokol OOH Dashboard' }],
      locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/preview.jpg'],
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
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
