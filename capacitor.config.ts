import type { CapacitorConfig } from "@capacitor/cli";

// This app stays a normal Next.js deployment on Vercel — Capacitor doesn't
// bundle a static export of it. Instead the native iOS/Android shells load
// server.url directly, the same way a browser would, so every server
// feature this app actually depends on (Server Components, Server Actions,
// the /api/notifications/email route, Supabase's cookie-based auth via
// @supabase/ssr) keeps working unmodified. A static `next export` isn't an
// option here: this app has no fully-static pages once you follow the auth
// flow, and several routes (program builder, coaching, insights) read
// request-scoped data on every load.
//
// The trade-off: without a bundled local build, there's no offline shell
// and every launch depends on network reachability, same as opening the
// site in a browser tab today. That's an acceptable starting point — the
// native wrapper's value here is the home-screen presence, app store
// listing, and a foothold for native APIs (push notifications is the
// obvious next one, wired through the existing notify()/sendNotificationEmail
// pattern in src/lib/notifications), not offline support.
const config: CapacitorConfig = {
  appId: "com.deloadhq.app",
  appName: "Deload",
  webDir: "public",
  server: {
    url: "https://deloadhq.com",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
