import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
    outputFileTracingIncludes: {
      '/**': [
        './node_modules/postmark/**',
        './node_modules/axios/**',
        './node_modules/form-data/**',
        './node_modules/follow-redirects/**',
        './node_modules/proxy-from-env/**',
        './node_modules/asynckit/**',
        './node_modules/combined-stream/**',
        './node_modules/delayed-stream/**',
        './node_modules/mime-types/**',
        './node_modules/mime-db/**',
      ],
    },
  },
};

export default withNextIntl(nextConfig);
