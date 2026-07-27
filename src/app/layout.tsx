import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BottomNav } from "@/components/bottom-nav";
import { RoleOnboarding } from "@/components/onboarding/role-onboarding";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/components/providers/auth-provider";
import "./globals.css";

const SITE_URL = "https://deloadhq.com";

// Kept in sync with the homepage's own hero copy (src/app/page.tsx) rather
// than written separately — a meta description that doesn't match what the
// page actually says is a well-known "looks like SEO spam" smell, and the
// old copy ("the internet's most trusted collection...") was exactly that:
// an unbacked superlative claim, the opposite of the no-invented-stats rule
// the rest of the site's copy already follows (see page.tsx's doc comment,
// og-image.tsx's "no fluff, no fake precision" line).
const SITE_DESCRIPTION =
  "Evidence-based training software for anyone serious about how they train — coaches, trainers, and athletes get real programs, live tracking, and free calculators backed by published research, not guesswork.";
const HOMEPAGE_OG_DESCRIPTION =
  "Deload is evidence-based training software for anyone serious about how they train — coaches, personal trainers, and athletes get a real program builder, live tracking, and tools backed by published research instead of guesswork.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Deload — Evidence-based training software",
    template: "%s | Deload",
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  // Next.js already auto-detects icon.tsx/apple-icon.tsx (src/app/) and
  // injects matching <link> tags without this — declared explicitly
  // anyway so the exact rel values Google's favicon docs look for
  // (rel="icon", the legacy "shortcut icon" alias, rel="apple-touch-icon")
  // are unambiguous rather than left to framework defaults. Doesn't change
  // what's served, just how plainly it's declared.
  icons: {
    icon: "/icon",
    shortcut: "/icon",
    apple: "/apple-icon",
  },
  // Home-screen install metadata — used both for "Add to Home Screen" in a
  // browser and as the base the Capacitor native shell wraps (see
  // capacitor.config.ts). manifest.webmanifest is a static file under
  // public/ rather than a generated route since it doesn't need anything
  // dynamic (no per-request data), unlike icon.tsx/apple-icon.tsx.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Deload",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Deload",
    title: "Deload — Evidence-based training software",
    description: HOMEPAGE_OG_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "SEV6LGAA88dSh8TOqKYPCS4tDubnzLM2SSYqCQOxFh0",
    other: {
      "msvalidate.01": "917B32DBCFE091EDF2EB3FFBE0B591E1",
    },
  },
};

// Separate from `metadata` — Next.js moved viewport/themeColor out of the
// Metadata type in 14 so they can vary independently (e.g. per-route dark
// mode). viewportFit: "cover" lets the page draw under the iPhone
// notch/home-indicator safe areas instead of leaving black bars there,
// which matters once this runs inside the Capacitor native shell (a
// browser tab doesn't have that edge-to-edge concern the same way).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#121215",
};

// Runs before hydration to avoid a light/dark flash. Dark is the default;
// this only overrides it if the visitor previously chose light mode.
const themeInitScript = `
(function() {
  try {
    var stored = window.localStorage.getItem('theme');
    if (stored === 'light') {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans antialiased">
        <AuthProvider>
          <ToastProvider>
            <div className="flex min-h-screen flex-col">
              <SiteHeader />
              {/* Bottom padding clears the fixed BottomNav bar (h-16 plus
                  its own safe-area inset) on mobile only — lg:pb-0 cancels
                  it out once BottomNav hides itself at the same lg
                  breakpoint. */}
              <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
              <SiteFooter />
            </div>
            <BottomNav />
            <RoleOnboarding />
          </ToastProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
