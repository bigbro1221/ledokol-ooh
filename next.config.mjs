import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/**': ['./node_modules/postmark/**'],
  },
  experimental: {
    instrumentationHook: true,
  },
};

export default withNextIntl(nextConfig);
