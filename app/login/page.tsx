"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginUrl, useAuth } from "@/lib/auth";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { authed, loading } = useAuth();
  const expired = params.get("expired") === "1";

  useEffect(() => {
    if (!loading && authed) {
      router.replace("/dashboard");
    }
  }, [authed, loading, router]);

  // Hide the card during the brief window where we're checking auth or
  // about to redirect — avoids flashing the sign-in CTA at someone who's
  // already signed in.
  if (loading || authed) {
    return null;
  }

  return (
    <main className="login-shell">
      <section className="login-card panel">
        <div className="brand" style={{ justifyContent: "center" }}>
          <span className="brand-badge">P</span>
          <span>Pegasus</span>
        </div>
        <h1>A quieter way to job hunt</h1>
        <p>
          Track every application. Tailor every resume. Forget nothing. Sign in with Google to get
          started.
        </p>
        {expired ? (
          <p className="muted small" style={{ marginTop: 8 }}>
            Your session expired — please sign in again.
          </p>
        ) : null}
        <div className="button-row">
          <a className="primary-button" href={loginUrl()}>
            Continue with Google
          </a>
          <Link className="ghost-button" href="/">
            Back home
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
