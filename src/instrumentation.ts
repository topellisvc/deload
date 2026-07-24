import * as Sentry from "@sentry/nextjs";

/**
 * Server + edge-runtime Sentry init (see instrumentation-client.ts for the
 * browser side). This whole file is a no-op until SENTRY_DSN is actually
 * set — nothing here calls Sentry.captureException etc. directly, that
 * still happens automatically via onRequestError below and Sentry's own
 * instrumentation of fetch/route handlers once init() has run.
 *
 * To activate: create a Sentry project, then set SENTRY_DSN (and
 * NEXT_PUBLIC_SENTRY_DSN for the client — see instrumentation-client.ts)
 * in .env.local for local dev and in Vercel's project env vars for
 * deployed environments. No code changes needed after that.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      tracesSampleRate: 1,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      tracesSampleRate: 1,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
