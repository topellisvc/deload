import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
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
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </div>
            <RoleOnboarding />
          </ToastProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
