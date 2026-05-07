import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pegasus",
  description:
    "A small calm place for the loud work of looking. Track applications, write notes, save resumes, and follow your search."
};

const sidebarBootScript = `
try {
  var v = localStorage.getItem('nc.sidebar-collapsed');
  document.documentElement.dataset.sb = (v === '0') ? 'expanded' : 'collapsed';
} catch (e) {
  document.documentElement.dataset.sb = 'collapsed';
}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-sb="collapsed">
      <head>
        <script dangerouslySetInnerHTML={{ __html: sidebarBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
