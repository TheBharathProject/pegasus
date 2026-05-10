import type { Metadata } from "next";
import LoginClientPage from "./login-client";

export const metadata: Metadata = {
  title: "Login to Pegasus",
  description:
    "Sign in to Pegasus with Google to manage job applications, recruiter conversations, resumes, and extension sync.",
  alternates: { canonical: "https://sypher.in/pegasus/login" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: "Login to Pegasus",
    description:
      "Sign in to Pegasus with Google to manage job applications, recruiter conversations, resumes, and extension sync.",
    url: "https://sypher.in/pegasus/login",
  },
};

export default function LoginPage() {
  return <LoginClientPage />;
}
