"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginUrl, useAuth } from "@/lib/auth";
import { MarketingFrame } from "@/components/frames";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.74-.06-1.29-.19-1.86H12v3.53h5.52c-.11.88-.71 2.21-2.03 3.1l-.02.12 2.82 2.14.2.02c1.86-1.68 3.11-4.14 3.11-7.05Z"
      />
      <path
        fill="#34A853"
        d="M12 21.9c2.7 0 4.97-.87 6.63-2.36l-3-2.28c-.8.55-1.87.93-3.63.93-2.64 0-4.88-1.68-5.68-4l-.11.01-2.93 2.23-.04.1c1.64 3.18 5.03 5.37 8.76 5.37Z"
      />
      <path
        fill="#FBBC05"
        d="M6.32 14.19A5.72 5.72 0 0 1 5.98 12c0-.76.13-1.5.34-2.19l-.01-.14-2.97-2.26-.1.05A9.64 9.64 0 0 0 2.4 12c0 1.58.39 3.06 1.08 4.37l2.84-2.18Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.81c2.22 0 3.71.94 4.56 1.73l3.33-3.17C16.96 1.74 14.7.1 12 .1c-3.73 0-7.12 2.18-8.76 5.36l3.08 2.34c.81-2.32 3.04-3.99 5.68-3.99Z"
      />
    </svg>
  );
}

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
      <MarketingFrame hideAuthCta>
        <main className="login-shell" />
      </MarketingFrame>
    );
  }

  return (
    <MarketingFrame hideAuthCta>
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

            <div className="login-mobile-cta">
              {expired ? (
                <p className="login-expired">Your session expired. Sign in again to continue.</p>
              ) : null}
              <a className="primary-button login-mobile-primary" href={loginUrl()}>
                <GoogleIcon className="login-google-icon" />
                Sign in with Google
              </a>
              <p className="login-mobile-note">No card. No spam. Just your search in one place.</p>
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
                <GoogleIcon className="login-google-icon" />
                Sign in with Google
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

export default function LoginClientPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
