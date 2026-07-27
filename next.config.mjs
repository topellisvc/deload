import { withSentryConfig } from "@sentry/nextjs";

// Insights article images now come from two places: hotlinked Unsplash
// photos (the seeded articles) and, since contributors can upload their
// own featured images (supabase/migrations/0026), the project's own
// Supabase Storage public URLs. Deriving the hostname from
// NEXT_PUBLIC_SUPABASE_URL (already required for the app to run at all)
// rather than hardcoding or wildcarding *.supabase.co keeps this scoped
// to exactly this project's storage, and it'll keep working unchanged if
// this ever moves to a self-hosted Supabase instance on a different host.
const supabaseHostname = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // next/image refuses to optimize any remote host that isn't explicitly
  // allowlisted here, even a trusted one.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      ...(supabaseHostname ? [{ protocol: "https", hostname: supabaseHostname }] : []),
    ],
  },
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
