import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./editorial.css";
import { Analytics } from "@vercel/analytics/next";
import { Header } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";
import { PreferencesProvider } from "@/features/preferences/preferences";
import { PlaceProvider } from "@/features/place/place";
import { PwaRegister } from "@/components/pwa-register";
import { DecisionsProvider } from "@/components/decisions-provider";
import { SessionProvider } from "@/components/session-provider";
import { PageMotion } from "@/components/ui/reveal";
import { getDecisions } from "@/server/decisions";
import { FirstVisitPersonalization } from "@/features/preferences/first-visit-personalization";

export const metadata: Metadata = {
  title: {
    default: "CivicLens — what's changing in Charlotte and Mecklenburg",
    template: "%s · CivicLens",
  },
  description:
    "Track decisions from Charlotte, Mecklenburg County and Charlotte-Mecklenburg Schools. Every claim links to the official government record.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#090a0b",
  width: "device-width",
  initialScale: 1,
};

// Refresh server-rendered pages every five minutes.
export const revalidate = 300;

const themeScript = `
  (() => {
    try {
      const saved = localStorage.getItem("civiclens-theme");
      const theme = saved === "light" || saved === "dark" ? saved : "dark";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
      document.querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", theme === "dark" ? "#090a0b" : "#eae0cb");
    } catch {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.style.colorScheme = "dark";
    }
  })();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const decisions = await getDecisions();
  const isVercelDeployment = process.env.VERCEL === "1";

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
                <PageMotion />
                <main id="main">{children}</main>
                <Footer />
                <FirstVisitPersonalization />
              </PlaceProvider>
            </PreferencesProvider>
          </DecisionsProvider>
        </SessionProvider>
        {isVercelDeployment ? <Analytics /> : null}
      </body>
    </html>
  );
}
