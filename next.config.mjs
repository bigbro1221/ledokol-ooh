import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
    outputFileTracingIncludes: {
      '/**': ['./node_modules/postmark/**'],
    },
  },
};

export default withNextIntl(nextConfig);
