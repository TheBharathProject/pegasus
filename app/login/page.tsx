"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginUrl, useAuth } from "@/lib/auth";
import { MarketingFrame } from "@/components/frames";

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
    return (
      <MarketingFrame>
        <main className="login-shell" />
      </MarketingFrame>
    );
  }

  return (
    <MarketingFrame>
      <main className="login-shell">
        <section className="login-stage">
          <div className="login-copy">
            <p className="login-eyebrow">Pegasus · Sign in</p>
            <h1 className="login-title">A calmer desk for the noisy work of job hunting.</h1>
            <p className="login-intro">
              Keep applications, recruiter threads, notes, and resume versions in one quiet
              surface. Sign in once and pick up your search from any device.
            </p>

            <div className="login-points" aria-label="Pegasus benefits">
              <article className="login-point">
                <span className="login-point-index">01</span>
                <div>
                  <h2>Track the real pipeline</h2>
                  <p>Roles, stages, follow-ups, and notes without spreadsheet drift.</p>
                </div>
              </article>
              <article className="login-point">
                <span className="login-point-index">02</span>
                <div>
                  <h2>Keep context attached</h2>
                  <p>Remember who referred you, what the recruiter said, and what to do next.</p>
                </div>
              </article>
              <article className="login-point">
                <span className="login-point-index">03</span>
                <div>
                  <h2>Sync across devices</h2>
                  <p>Use the same account in the app and extension without losing your place.</p>
                </div>
              </article>
            </div>
          </div>

          <section className="login-card" aria-label="Sign in to Pegasus">
            <div className="login-card-brand">
              <span className="brand-badge">P</span>
              <span>Pegasus</span>
            </div>
            <h2 className="login-card-title">Continue with Google</h2>
            <p className="login-card-copy">
              Use the same Google account you want to use for your application tracker and browser
              extension.
            </p>
            {expired ? (
              <p className="login-expired">Your session expired. Sign in again to continue.</p>
            ) : null}
            <div className="login-actions">
              <a className="primary-button login-primary" href={loginUrl()}>
                Continue with Google
              </a>
              <Link className="ghost-button login-secondary" href="/">
                Back home
              </Link>
            </div>
            <p className="login-note">No card. No spam. Just your search in one place.</p>
          </section>
        </section>
      </main>
    </MarketingFrame>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
