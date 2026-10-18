import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Header } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";
import { PreferencesProvider } from "@/features/preferences/preferences";
import { PlaceProvider } from "@/features/place/place";
import { PwaRegister } from "@/components/pwa-register";
import { DecisionsProvider } from "@/components/decisions-provider";
import { SessionProvider } from "@/components/session-provider";
import { getDecisions } from "@/server/decisions";

export const metadata: Metadata = {
  title: {
    default: "CivicLens — what's changing in Charlotte and Mecklenburg",
    template: "%s · CivicLens",
  },
  description:
    "Track decisions from Charlotte, Mecklenburg County and Charlotte-Mecklenburg Schools. Every claim links to the official government record.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#102a26",
  width: "device-width",
  initialScale: 1,
};

/**
 * Records change a few times a day at most, so the shell is revalidated rather
 * than rendered on every request. The ingestion pipeline can force a refresh
 * with `revalidateTag("decisions")`.
 */
export const revalidate = 300;

const themeScript = `(()=>{try{const saved=localStorage.getItem('civiclens-theme');const theme=saved==='light'||saved==='dark'?saved:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme}catch{}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const decisions = await getDecisions();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <SessionProvider>
          <DecisionsProvider decisions={decisions}>
            <PreferencesProvider>
              <PlaceProvider>
                <PwaRegister />
              <a
                href="#main"
                className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:font-bold focus:text-ink"
              >
                Skip to content
              </a>
                <Header />
                <main id="main">{children}</main>
                <Footer />
              </PlaceProvider>
            </PreferencesProvider>
          </DecisionsProvider>
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
