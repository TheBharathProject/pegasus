"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRightIcon,
  BellOffIcon,
  BriefcaseIcon,
  ContactIcon,
  GaugeIcon,
  ShieldCheckIcon,
  SparkleIcon
} from "@/components/icons";
import { homeFaqs, homeFeatures, homePersonas, homePreviewApplications } from "@/lib/site-data";

const FEATURE_ICONS = [BriefcaseIcon, ContactIcon, GaugeIcon, BellOffIcon, ShieldCheckIcon, SparkleIcon];
const SIGN_IN_HREF = "/login";

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3a14.4 14.4 0 0 0-.617 1.265 18.27 18.27 0 0 0-5.487 0A12.59 12.59 0 0 0 9.83 3a19.74 19.74 0 0 0-3.76 1.369C2.474 9.788 1.498 15.07 1.99 20.275a19.93 19.93 0 0 0 6.073 3.067 14.85 14.85 0 0 0 1.297-2.106 12.84 12.84 0 0 1-2.043-.978c.171-.124.339-.255.5-.388a14.16 14.16 0 0 0 12.366 0c.162.135.33.265.5.388a12.85 12.85 0 0 1-2.046.98 14.65 14.65 0 0 0 1.296 2.105 19.91 19.91 0 0 0 6.075-3.067c.575-6.016-.978-11.25-4.69-15.907ZM8.65 17.13c-1.183 0-2.158-1.082-2.158-2.413 0-1.331.954-2.418 2.158-2.418 1.205 0 2.18 1.087 2.158 2.418 0 1.331-.954 2.413-2.158 2.413Zm6.7 0c-1.183 0-2.158-1.082-2.158-2.413 0-1.331.954-2.418 2.158-2.418 1.205 0 2.18 1.087 2.158 2.418 0 1.331-.953 2.413-2.158 2.413Z" />
    </svg>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={open ? "nc-faq open" : "nc-faq"}>
      <button type="button" className="nc-faq-q" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{q}</span>
        <span className="nc-faq-chev" aria-hidden="true">
          {open ? "–" : "+"}
        </span>
      </button>
      {open ? <div className="nc-faq-a">{a}</div> : null}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="nc-home">
      <header className="nc-topnav">
        <div className="nc-topnav-inner">
          <Link className="nc-brand" href="/">
            <span className="nc-brand-logo">NC</span>
            <span className="nc-brand-text">Naukri Clear</span>
            <span className="nc-brand-tag">Free job application tracker</span>
          </Link>
          <nav className="nc-topnav-links">
            <a href="#features">Features</a>
            <a href="#who-its-for">Who it&apos;s for</a>
            <a href="#faq">FAQ</a>
            <Link href="/blog">Blog</Link>
            <Link className="nc-topnav-signin" href={SIGN_IN_HREF}>
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="nc-hero">
        <div className="nc-hero-glow" aria-hidden="true" />
        <div className="nc-hero-inner">
          <div className="nc-eyebrow-chip">
            <span className="nc-dot" /> Free for job seekers · No spam, no ads
          </div>
          <h1 className="nc-hero-title">A quieter way to track your job hunt.</h1>
          <p className="nc-hero-sub">
            Stop juggling spreadsheets, sticky notes, and a hundred recruiter emails. Naukri Clear
            keeps every application, every conversation, and every next step in one calm place —
            built for the way you actually job hunt.
          </p>
          <div className="nc-cta-row">
            <Link className="nc-btn-primary" href={SIGN_IN_HREF}>
              Start tracking — it&apos;s free <ArrowRightIcon width={15} height={15} />
            </Link>
            <a className="nc-btn-ghost" href="#features">
              See what&apos;s inside
            </a>
          </div>
          <p className="nc-hero-foot">Sign in with Google · 30 seconds to first application</p>

          <div className="nc-preview">
            <div className="nc-preview-bar">
              <span className="nc-dot-r" />
              <span className="nc-dot-y" />
              <span className="nc-dot-g" />
              <span className="nc-preview-url">naukriclear.com / dashboard</span>
            </div>
            <div className="nc-preview-grid">
              <aside className="nc-preview-side">
                <p className="nc-preview-eyebrow">Pipeline</p>
                {["Dashboard", "Applications", "Recruiters", "Templates", "Profile"].map((label, i) => (
                  <div key={label} className={i === 1 ? "nc-preview-link active" : "nc-preview-link"}>
                    {label}
                  </div>
                ))}
              </aside>
              <div className="nc-preview-main">
                <div className="nc-preview-title">Applications</div>
                <div className="nc-preview-meta">12 active · 3 awaiting reply</div>
                <div className="nc-preview-rows">
                  {homePreviewApplications.map((app) => (
                    <div className="nc-preview-row" key={app.company}>
                      <div>
                        <div className="nc-preview-company">{app.company}</div>
                        <div className="nc-preview-role">{app.role}</div>
                      </div>
                      <span
                        className={
                          "nc-stage " +
                          (app.stage === "Offer"
                            ? "nc-stage-offer"
                            : app.stage === "Interview"
                              ? "nc-stage-interview"
                              : "nc-stage-default")
                        }
                      >
                        {app.stage}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="nc-section nc-section-soft">
        <div className="nc-section-inner">
          <div className="nc-section-head">
            <p className="nc-eyebrow">What&apos;s inside</p>
            <h2>Everything you need. Nothing you don&apos;t.</h2>
            <p className="nc-section-sub">
              We didn&apos;t build a CRM. We built the small tool you wish you had at 11pm on a
              Sunday, refreshing your inbox.
            </p>
          </div>
          <div className="nc-feature-grid">
            {homeFeatures.map((f, i) => {
              const Icon = FEATURE_ICONS[i] ?? BriefcaseIcon;
              return (
                <article key={f.title} className="nc-feature-card">
                  <span className="nc-feature-icon">
                    <Icon width={17} height={17} />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="who-its-for" className="nc-section">
        <div className="nc-section-inner">
          <div className="nc-section-head">
            <p className="nc-eyebrow">Who it&apos;s for</p>
            <h2>Built for the people who actually job hunt.</h2>
          </div>
          <div className="nc-persona-grid">
            {homePersonas.map((p) => (
              <article key={p.name} className="nc-persona">
                <div className="nc-persona-name">{p.name}</div>
                <p className="nc-persona-line">{p.line}</p>
                <p className="nc-persona-quote">&ldquo;{p.quote}&rdquo;</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="nc-section nc-section-soft">
        <div className="nc-faq-inner">
          <div className="nc-section-head">
            <p className="nc-eyebrow">Questions</p>
            <h2>You&apos;re probably wondering…</h2>
          </div>
          <div className="nc-faq-stack">
            {homeFaqs.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      <section className="nc-section nc-cta">
        <div className="nc-cta-inner">
          <h2>Your job hunt deserves a calmer home.</h2>
          <p>
            Sign in with Google and get your first application tracked in under a minute. No card,
            no commitment, no email spam.
          </p>
          <div className="nc-cta-row">
            <Link className="nc-btn-primary" href={SIGN_IN_HREF}>
              Start tracking — it&apos;s free <ArrowRightIcon width={15} height={15} />
            </Link>
            <a
              className="nc-btn-ghost"
              href="https://discord.gg/XBAYqhK9"
              target="_blank"
              rel="noreferrer"
            >
              <DiscordIcon className="nc-discord-icon" /> Join our Discord
            </a>
          </div>
          <p className="nc-cta-foot">
            Found a bug or have an idea? Tell us in Discord — we read every message.
          </p>
        </div>
      </section>

      <footer className="nc-footer">
        <div className="nc-footer-inner">
          <div className="nc-footer-brand">
            <span className="nc-brand-logo small">NC</span>
            <span>Naukri Clear · made by Jaan Mustafa</span>
          </div>
          <nav className="nc-footer-nav">
            <a href="https://discord.gg/XBAYqhK9" target="_blank" rel="noreferrer">
              <DiscordIcon className="nc-footer-discord" /> Discord
            </a>
            <Link href="/blog">Blog</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="mailto:hello@example.com">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
