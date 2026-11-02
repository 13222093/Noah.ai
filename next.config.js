// next.config.js
const { withSentryConfig } = require('@sentry/nextjs');
// PWA / service worker disabled in W1 (G-123, guardrail 7): an offline cache can
// show old numbers as if they were current. public/sw.js is now a kill-switch
// that unregisters any worker installed by the old public app.

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone only for Docker; skip on Windows to avoid copyfile EINVAL with node:inspector paths
  ...(process.env.NEXT_STANDALONE === '1' && { output: 'standalone' }),
  experimental: {},
  // The '/' -> /landing.html rewrite (public marketing site) was removed in W1 (B-009).
  async headers() {
    return [
      // The trial is not public: tell crawlers not to index anything.
      { source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      // Make browsers re-check the kill-switch worker instead of caching it.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
  // Konfigurasi Webpack yang sudah ada
  webpack: (config, { isServer }) => {
    // Konfigurasi ini hanya berlaku untuk build sisi server,
    // untuk memberitahu Webpack agar tidak mencoba membundel modul native Node.js
    if (isServer) {
      config.externals.push('bufferutil', 'utf-8-validate');
    }
    return config;
  },

  images: {
    remotePatterns: [
    ],
    formats: ['image/avif', 'image/webp'],
  },
};

const sentryWebpackPluginOptions = {
  silent: true, // Suppresses all logs
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
