import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

// withSentryConfig is a safe no-op wrapper without SENTRY_AUTH_TOKEN set —
// it only affects source-map upload/release creation at build time, not
// runtime error capture (that's src/instrumentation.ts and
// src/instrumentation-client.ts, gated on the DSN instead). So this can
// stay wrapped unconditionally rather than branching on whether Sentry is
// "configured yet."
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // A missing/invalid org+project+authToken shouldn't fail a build that
  // otherwise has nothing to do with Sentry yet — warn and move on instead
  // of throwing, until those are actually set (e.g. in Vercel's env vars).
  errorHandler: (err) => {
    console.warn("[sentry] build-time step skipped:", err.message);
  },
  widenClientFileUpload: true,
  disableLogger: true,
});
