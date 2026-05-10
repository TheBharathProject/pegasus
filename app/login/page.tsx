import type { Metadata } from "next";
import LoginClientPage from "./login-client";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to Pegasus with Google.",
  alternates: { canonical: "https://sypher.in/pegasus/login" },
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginClientPage />;
}
