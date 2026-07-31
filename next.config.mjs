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

// Third-party network surface is deliberately small and already known: the
// Supabase project itself (REST + Realtime websockets, for the live
// message-thread/notification-bell subscriptions), Unsplash-hosted seed
// article images, and Sentry's ingest endpoint for client-side error
// reporting (src/instrumentation-client.ts). Vercel Analytics/Speed
// Insights (src/app/layout.tsx's <Analytics />/<SpeedInsights />) are
// same-origin ONLY on an actual Vercel deployment, where Vercel's edge
// proxies them under /_vercel/*. Anywhere else — `next dev`, or any
// non-Vercel host — both packages fall back to fetching their debug build
// directly from https://va.vercel-scripts.com/v1/*.debug.js (console-only
// logging, no real data collection), so that host needs to be allowlisted
// too or the browser blocks it outright.
//
// script-src and style-src both need 'unsafe-inline': this app has no
// nonce plumbing (that needs a middleware.ts generating a per-request
// nonce and threading it through <script>/<style> tags), and both
// Next.js's own RSC/hydration payloads and this app's own
// dangerouslySetInnerHTML usage (layout.tsx's dark-mode-flash guard,
// the JSON-LD blocks in insights pages) rely on inline tags. Tightening
// this further is a real follow-up, not a small tweak.
const isProd = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  // 'unsafe-eval' only in dev: `next dev`'s fast-refresh/HMR runtime
  // relies on eval() to patch modules in place (its default devtool is
  // eval-source-map), so a strict script-src breaks `npm run dev` outright
  // — every client component silently stops hydrating (auth state,
  // ThemeToggle, the notification badge, all of it) with a CSP EvalError
  // in the console. `next build`'s production output doesn't eval(), so
  // prod stays on the stricter policy without it.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval' https://va.vercel-scripts.com"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://images.unsplash.com${supabaseHostname ? ` https://${supabaseHostname}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabaseHostname ? ` https://${supabaseHostname} wss://${supabaseHostname}` : ""} https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io${isProd ? "" : " ws://localhost:* http://localhost:*"}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // Vercel terminates TLS in front of every deployment (prod and preview
  // alike), so this is safe to send unconditionally there — but sending
  // it in dev too would make the browser force-upgrade a future plain
  // `http://localhost` request to https and hard-fail, so it's prod-only.
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
