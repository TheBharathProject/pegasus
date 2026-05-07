"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "@/lib/auth";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("token");
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

export default function AuthCallbackPage() {
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
