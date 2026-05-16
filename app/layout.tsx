import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { EB_Garamond } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { AnalyticsBootstrap } from "@/components/analytics-bootstrap";
import { StorageSync } from "@/components/storage-sync";

// GA4 measurement id — supplied per environment via
// NEXT_PUBLIC_GA_ID (kept in sync with sypher-shell so both apps can
// share one GA property). Left empty in local dev so the gtag script
// is never injected and track() short-circuits.
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID;

// Resume Builder font(s) — self-hosted via Next.js at build time so the
// HTML preview can render in the same family the LaTeX compile uses.
// The CSS variable is consumed by the font-registry's web stack
// (lib/resume-builder/font-registry.ts).
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-eb-garamond",
  // 400 = body, 500 = subhead, 700 = \bfseries section header,
  // 800 = name (matches the bumped CSS font-weight in
  // .rb-preview-head h1).
  weight: ["400", "500", "700", "800"],
  style: ["normal", "italic"]
});

export const metadata: Metadata = {
  title: "Pegasus",
  description:
    "A small calm place for the loud work of looking. Track applications, write notes, save resumes, and follow your search."
};

// Inline boot script — runs before first paint to avoid a flash of the wrong
// theme. Reads localStorage["sypher.theme"] (shared across every Sypher tool
// on the same origin), falls back to OS preference, stamps data-theme on
// <html>. Sidebar collapse state lives here too so we don't pay for two
// inline scripts.
const bootScript = `
try {
  var sb = localStorage.getItem('nc.sidebar-collapsed');
  document.documentElement.dataset.sb = (sb === '0') ? 'expanded' : 'collapsed';
  var pref = localStorage.getItem('sypher.theme') || 'system';
  var resolved = pref === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : pref;
  document.documentElement.dataset.theme = resolved;
} catch (e) {
  document.documentElement.dataset.sb = 'collapsed';
  document.documentElement.dataset.theme = 'dark';
}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-sb="collapsed"
      data-theme="dark"
      className={ebGaramond.variable}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <StorageSync />
        {/* AnalyticsBootstrap consumes useSearchParams; Suspense
            boundary required for static prerender, matching the
            pattern at app/resume-builder/page.tsx. */}
        <Suspense fallback={null}>
          <AnalyticsBootstrap />
        </Suspense>
        {children}
        {GA_MEASUREMENT_ID ? (
          <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />
        ) : null}
      </body>
    </html>
  );
}
