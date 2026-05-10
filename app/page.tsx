import type { Metadata } from "next";
import HomePageClient from "./home-page-client";

const description =
  "A calm job application tracker for managing roles, recruiter conversations, resumes, and next steps.";

export const metadata: Metadata = {
  title: "Pegasus",
  description,
  alternates: { canonical: "https://sypher.in/pegasus" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: "Pegasus",
    description,
    url: "https://sypher.in/pegasus",
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
