import type { Metadata } from "next";
import HomePageClient from "./home-page-client";

const description =
  "A calm job application tracker for managing roles, recruiter conversations, resumes, and next steps.";

// metadataBase resolves any relative og:image / twitter:image URLs
// (including the one Next.js auto-injects for app/opengraph-image.tsx)
// against the production origin. Without it, social scrapers see
// http://localhost — preview images don't render.
export const metadata: Metadata = {
  metadataBase: new URL("https://sypher.in"),
  title: "Pegasus",
  description,
  alternates: { canonical: "https://sypher.in/pegasus" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: "Pegasus",
    description,
    url: "https://sypher.in/pegasus",
    siteName: "Sypher"
    // Image is auto-injected from app/opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    title: "Pegasus",
    description
    // Image is auto-injected from app/twitter-image.tsx (or falls
    // back to the og:image when only opengraph-image is present).
  }
};

export default function HomePage() {
  return <HomePageClient />;
}
