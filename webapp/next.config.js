/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

// Wrap with Sentry if installed
// To enable: npm install @sentry/nextjs
// Then add NEXT_PUBLIC_SENTRY_DSN to your environment
let config = nextConfig

try {
  const { withSentryConfig } = require('@sentry/nextjs')

  const sentryWebpackPluginOptions = {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // Upload source maps to Sentry
    widenClientFileUpload: true,

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
  }

  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    config = withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  }
} catch {
  // Sentry not installed, continue without it
}

module.exports = config
