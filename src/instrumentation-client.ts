import * as Sentry from "@sentry/nextjs";

/**
 * Browser-side Sentry init — see src/instrumentation.ts for the
 * server/edge side and the activation steps (both read from env vars, so
 * there's nothing to change here once SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN
 * are set). Uses NEXT_PUBLIC_ prefix because this file ships to the
 * browser, unlike the server one.
 *
 * Session Replay is left off (0% sample rates) rather than omitted
 * outright — turning it on later is a one-line change here instead of
 * reinstalling anything, but it wasn't part of what was asked for
 * (error monitoring), and replay has its own privacy/PII implications
 * worth a deliberate decision rather than a default.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
