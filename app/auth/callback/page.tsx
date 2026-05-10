import type { Metadata } from "next";
import CallbackClientPage from "./callback-client";

export const metadata: Metadata = {
  title: "Auth Callback",
  description: "Completing Pegasus sign-in.",
  robots: { index: false, follow: false },
};

export default function AuthCallbackPage() {
  return <CallbackClientPage />;
}
