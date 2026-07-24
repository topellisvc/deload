"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * The one error boundary Next.js lets replace the entire root layout —
 * it's what catches an error thrown by layout.tsx itself, which a normal
 * error.tsx can't (it renders *inside* the layout, so it's already gone if
 * the layout is what broke). Sentry's docs call this out specifically:
 * without it, root-layout-level errors never reach Sentry at all. Kept
 * deliberately minimal and self-contained (own <html>/<body>, no shared
 * providers/components) since those may be exactly what failed.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body style={{ background: "#0a0a0a", color: "#fafafa" }}>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", padding: "1.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ fontSize: "0.875rem", opacity: 0.7, maxWidth: "28rem" }}>
            We&apos;ve been notified and are looking into it. Try reloading the page.
          </p>
        </div>
      </body>
    </html>
  );
}
