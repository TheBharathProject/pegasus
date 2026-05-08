import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { StorageSync } from "@/components/storage-sync";

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
    <html lang="en" data-sb="collapsed" data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <StorageSync />
        {children}
      </body>
    </html>
  );
}
