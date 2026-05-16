"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import { setToken } from "@/lib/auth";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Prefer the URL fragment (#token=...) — it never hits server access
    // logs or Referer headers. Fall back to the query string (?token=...)
    // for backwards compatibility with any old auth redirect URLs that
    // might still be cached. Clean up the URL after we've stashed it so
    // a refresh doesn't re-trigger the callback.
    let token: string | null = null;
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      token = hashParams.get("token");
      // Clear the fragment so the token doesn't sit in history.
      if (token) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
    if (!token) {
      token = params.get("token");
    }
    const err = params.get("error");
    if (err) {
      setError(err);
      return;
    }
    if (!token) {
      setError("missing_token");
      return;
    }
    setToken(token);
    // Only Google SSO routes through this callback today (the email
    // path is unreleased). When that lands we'll need to plumb the
    // method through the query string.
    track({ name: "login_succeeded", params: { method: "google" } });
    router.replace("/dashboard");
  }, [params, router]);

  return (
    <main className="login-shell">
      <section className="login-card panel">
        <h1>{error ? "Sign-in failed" : "Signing you in…"}</h1>
        {error ? (
          <p>
            We couldn&apos;t complete the sign-in: <code>{error}</code>. Please try again.
          </p>
        ) : (
          <p>One moment while we hand you over to your dashboard.</p>
        )}
      </section>
    </main>
  );
}

export default function CallbackClientPage() {
  return (
    <Suspense
      fallback={
        <main className="login-shell">
          <section className="login-card panel">
            <h1>Signing you in…</h1>
          </section>
        </main>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
