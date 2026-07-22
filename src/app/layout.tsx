import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const SITE_URL = "https://deloadhq.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Deload — Evidence-based training tools",
    template: "%s | Deload",
  },
  description:
    "The internet's most trusted collection of evidence-based training tools for athletes and coaches. Start with our one-rep max calculator.",
  openGraph: {
    type: "website",
    siteName: "Deload",
    title: "Deload — Evidence-based training tools",
    description:
      "The internet's most trusted collection of evidence-based training tools for athletes and coaches.",
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
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
