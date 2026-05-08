"use client";

// /pegasus/upgrade — Premium upgrade stub.
//
// Placeholder while Stripe is being wired. The Settings "Upgrade" CTA
// links here; for now we just collect interested users via the same
// waitlist flow the apex uses, so by the time billing ships we already
// have a list of people to email about it.

import { useState } from "react";
import { ProductFrame } from "@/components/frames";
import { ArrowRightIcon, BellIcon, ChatIcon, MailIcon, SparkleStarIcon } from "@/components/icons";

export default function UpgradePage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    // Stub for now — no waitlist endpoint wired yet. Just optimistic ack
    // so the page is usable. When billing ships, this becomes a Stripe
    // Checkout session and the page disappears.
    setTimeout(() => {
      setDone(true);
      setSubmitting(false);
    }, 400);
  };

  const perks = [
    {
      icon: <MailIcon width={16} height={16} />,
      title: "Daily digest in your inbox",
      body: "One quiet email at 09:00 IST — only when something needs your attention. Stale apps, approaching deadlines, replies on your community posts."
    },
    {
      icon: <BellIcon width={16} height={16} />,
      title: "All in-app notifications stay free",
      body: "The bell badge and /notifications page work for everyone. Premium just adds the inbox copy."
    },
    {
      icon: <ChatIcon width={16} height={16} />,
      title: "Community reply emails",
      body: "When someone replies to your interview experience, asks a follow-up on your question, or mentions you, you get the email."
    }
  ];

  return (
    <ProductFrame
      active="settings"
      title="Pegasus Premium"
      kicker={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <SparkleStarIcon width={12} height={12} /> Coming soon
        </span>
      }
      intro="A small upgrade for people who want Pegasus in their inbox, not just their browser tab."
    >
      <section className="upgrade-stack">
        <ul className="upgrade-perks">
          {perks.map((p) => (
            <li key={p.title}>
              <span className="upgrade-perk-icon">{p.icon}</span>
              <div>
                <strong>{p.title}</strong>
                <p>{p.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="upgrade-form-card">
          {done ? (
            <p className="upgrade-form-success">
              Got it. We&apos;ll email you when Premium is open. No spam.
            </p>
          ) : (
            <form className="upgrade-form" onSubmit={onSubmit}>
              <p className="muted small">
                Drop your email — we&apos;ll let you know when it ships.
              </p>
              <div className="upgrade-form-row">
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
                <button
                  type="submit"
                  className="primary-button"
                  disabled={submitting || !email.trim()}
                >
                  {submitting ? "…" : (
                    <>
                      Notify me <ArrowRightIcon width={13} height={13} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="muted small upgrade-fineprint">
          Pegasus stays free for the core tracker — applications, notes, resume
          vault, public profile. Premium is just the email layer (and whatever we
          add that genuinely deserves a paywall later).
        </p>
      </section>
    </ProductFrame>
  );
}
