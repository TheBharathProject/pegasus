"use client";

import Link from "next/link";
import { loginUrl } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-card panel">
        <div className="brand" style={{ justifyContent: "center" }}>
          <span className="brand-badge">NC</span>
          <span>Naukri Clear</span>
        </div>
        <h1>A quieter way to job hunt</h1>
        <p>
          Track every application. Tailor every resume. Forget nothing. Sign in with Google to get
          started.
        </p>
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
