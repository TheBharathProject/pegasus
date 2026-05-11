"use client";

// /pegasus/upgrade — three checkout paths into Razorpay:
//
//   1. Premium · monthly  — recurring subscription via eMandate.
//   2. Premium · 30-day pass — one-time order, no autopay.
//   3. Credits packs — one-time orders that increment credits_balance.
//
// All three open the Razorpay Checkout JS modal. We load checkout.js
// lazily on first interaction so the page itself stays light.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProductFrame } from "@/components/frames";
import {
  ArrowRightIcon,
  BellIcon,
  ChatIcon,
  MailIcon,
  SparkleStarIcon,
} from "@/components/icons";
import { api, type ApiBillingMe } from "@/lib/api-client";
import { fetchBillingMe } from "@/lib/billing";
import { isAuthed } from "@/lib/auth";
import { goTo } from "@/lib/paths";

// Mirror billing.CreditPacks from the backend so the layout can render
// without a round-trip. The actual pricing is server-authoritative —
// the backend ignores body amounts and enforces packs.go.
type CreditPack = {
  id: string;
  label: string;
  amountPaise: number;
  credits: number;
};

const FALLBACK_PACKS: CreditPack[] = [
  { id: "starter", label: "Starter", amountPaise: 9900, credits: 100 },
  { id: "plus", label: "Plus", amountPaise: 24900, credits: 350 },
  { id: "pro", label: "Pro", amountPaise: 49900, credits: 700 },
];

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

// loadRazorpay injects checkout.js once and resolves when window.Razorpay
// is available. Subsequent calls reuse the same load. The script only
// adds ~70 KB and we never need to keep it pre-loaded for visitors who
// won't open Checkout.
let rzpScriptPromise: Promise<void> | null = null;
function loadRazorpay(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  // already on window? checkout.js sets window.Razorpay synchronously.
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
    return Promise.resolve();
  }
  if (rzpScriptPromise) return rzpScriptPromise;
  rzpScriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = RAZORPAY_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("razorpay checkout script failed to load"));
    document.head.appendChild(s);
  });
  return rzpScriptPromise;
}

type RazorpayInstance = {
  open: () => void;
  close: () => void;
};
type RazorpayCtor = new (opts: Record<string, unknown>) => RazorpayInstance;

export default function UpgradePage() {
  const [busy, setBusy] = useState<string | null>(null); // path key currently checking out
  const [error, setError] = useState<string | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>(FALLBACK_PACKS);
  // billing snapshot — drives the "you're already on Premium" banner
  // and hides the upsell plan cards when the user is already a member.
  const [billing, setBilling] = useState<ApiBillingMe | null>(null);
  const creditsRef = useRef<HTMLDivElement | null>(null);

  // Pull the authoritative pack list + the current premium state off
  // /billing/me. If the call fails (e.g. user not signed in), fall back
  // to the bundled pack list and treat as free-tier for the upsell.
  // Pre-warm checkout.js while we wait — by the time the user clicks
  // Subscribe, the SDK is already cached. Fire-and-forget; failure
  // only matters at click time and is surfaced there.
  useEffect(() => {
    if (!isAuthed()) return;
    void loadRazorpay().catch(() => {
      /* swallow — startCheckout will surface the error on click */
    });
    fetchBillingMe()
      .then((r) => {
        setBilling(r);
        if (Array.isArray(r.creditPacks) && r.creditPacks.length > 0) {
          setPacks(r.creditPacks as unknown as CreditPack[]);
        }
      })
      .catch(() => {
        // Stay on FALLBACK_PACKS + null billing; Premium banner won't
        // render. The actual checkout still succeeds because pricing is
        // server-side and the user can re-auth from there.
      });
  }, []);

  // Premium derived flags — single source of truth for the page's
  // conditional rendering (banner, plan cards, CTAs).
  const activePremium = billing?.premium && billing.premium.status === "active"
    ? billing.premium
    : null;
  const onRecurring = activePremium?.kind === "recurring" && !activePremium.cancelAtPeriodEnd;

  // Scroll to credits if the URL hash asks for it (e.g. /upgrade#credits
  // from the Settings billing section's "Top up" CTA).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#credits" && creditsRef.current) {
      creditsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const startCheckout = async (
    label: string,
    fetcher: () => Promise<{ keyId: string; razorpaySubscriptionId?: string; razorpayOrderId?: string; amount: number; currency?: string }>,
    successMessage: string
  ) => {
    if (!isAuthed()) {
      goTo("/login?next=/upgrade");
      return;
    }
    setError(null);
    setBusy(label);
    try {
      const [, resp] = await Promise.all([loadRazorpay(), fetcher()]);
      const Razorpay = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
      if (!Razorpay) throw new Error("Razorpay script unavailable");

      const opts: Record<string, unknown> = {
        key: resp.keyId,
        amount: resp.amount,
        currency: resp.currency ?? "INR",
        name: "Pegasus",
        description: label,
        handler: () => {
          // Payment completed in Checkout — actual state changes happen
          // via webhook. Bounce to /settings with the success copy.
          // Route through goTo() so basePath stays in one place.
          goTo(`/settings?billing=${encodeURIComponent(successMessage)}`);
        },
        modal: {
          ondismiss: () => {
            setBusy(null);
          },
        },
        theme: { color: "#0a0a0a" },
      };
      if (resp.razorpaySubscriptionId) {
        opts.subscription_id = resp.razorpaySubscriptionId;
      } else if (resp.razorpayOrderId) {
        opts.order_id = resp.razorpayOrderId;
      }

      const rzp = new Razorpay(opts);
      rzp.open();
    } catch (e) {
      setError((e as Error).message || "Could not start checkout");
      setBusy(null);
    }
  };

  const checkoutMonthly = () =>
    startCheckout(
      "monthly",
      () =>
        api.post<{
          keyId: string;
          razorpaySubscriptionId: string;
          amount: number;
          currency: string;
        }>("/billing/checkout/subscription", {}),
      "Welcome to Pegasus Premium"
    );

  const checkoutPass = () =>
    startCheckout(
      "pass",
      () =>
        api.post<{
          keyId: string;
          razorpayOrderId: string;
          amount: number;
          currency: string;
        }>("/billing/checkout/premium-pass", {}),
      "Welcome to Pegasus Premium"
    );

  // Premium+ tier — recurring ₹299/mo with 200 credits granted on
  // every successful charge. Backend uses RAZORPAY_PLAN_ID_PLUS.
  const checkoutPlus = () =>
    startCheckout(
      "plus",
      () =>
        api.post<{
          keyId: string;
          razorpaySubscriptionId: string;
          amount: number;
          currency: string;
        }>("/billing/checkout/subscription-plus", {}),
      "Welcome to Pegasus Premium+"
    );

  const checkoutCredits = (pack: CreditPack) =>
    startCheckout(
      `credits:${pack.id}`,
      () =>
        api.post<{
          keyId: string;
          razorpayOrderId: string;
          amount: number;
          currency: string;
          credits: number;
        }>("/billing/checkout/credits", { packId: pack.id }),
      `+${pack.credits} credits added`
    );

  const perks = [
    {
      icon: <MailIcon width={16} height={16} />,
      title: "Daily digest in your inbox",
      body: "One quiet email at 09:00 IST — only when something needs your attention. Stale apps, approaching deadlines, replies on your community posts.",
    },
    {
      icon: <BellIcon width={16} height={16} />,
      title: "All in-app notifications stay free",
      body: "The bell badge and /notifications page work for everyone. Premium just adds the inbox copy.",
    },
    {
      icon: <ChatIcon width={16} height={16} />,
      title: "Community reply emails",
      body: "When someone replies to your interview experience, asks a follow-up on your question, or mentions you, you get the email.",
    },
  ];

  return (
    <ProductFrame
      active="settings"
      title="Pegasus Premium"
      kicker={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <SparkleStarIcon width={12} height={12} /> Upgrade
        </span>
      }
      intro="Two charge types — pick the one that fits. Subscriptions auto-renew; passes don't. Credits live separately for paid AI features."
    >
      <section className="upgrade-stack">
        {activePremium ? (
          // ─── Already a Premium member ─────────────────────────────
          // Don't show the upsell plan cards — they read as "you're not
          // upgraded yet" which is wrong. Show a banner with the active
          // plan and a link to manage in Settings. Credits section
          // below is always visible regardless of premium state.
          <div className="upgrade-current-banner">
            <div className="upgrade-current-main">
              <p className="eyebrow">Your plan</p>
              <h2 className="upgrade-current-title">
                {activePremium.kind === "recurring"
                  ? activePremium.planTier === "plus"
                    ? activePremium.cancelAtPeriodEnd
                      ? "Premium+ · auto-renew off"
                      : "Premium+ · monthly"
                    : activePremium.cancelAtPeriodEnd
                    ? "Premium · auto-renew off"
                    : "Premium · monthly"
                  : "Premium · 30-day pass"}
              </h2>
              <p className="upgrade-current-sub">
                <em>active</em> —{" "}
                {activePremium.cancelAtPeriodEnd ? "ends" : activePremium.kind === "recurring" ? "renews" : "expires"}{" "}
                {activePremium.currentPeriodEnd
                  ? new Date(activePremium.currentPeriodEnd).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    })
                  : "soon"}
                {" · ₹"}
                {Math.round(activePremium.amountPaise / 100)}
              </p>
            </div>
            <Link className="ghost-button upgrade-current-cta" href="/settings">
              Manage in Settings <ArrowRightIcon width={13} height={13} />
            </Link>
          </div>
        ) : (
          <>
            <h2 className="upgrade-section-title">Premium tier</h2>
            <p className="muted small upgrade-section-copy">
              Email digest + community reply emails. The free tier always keeps in-app
              notifications.
            </p>
            <div className="upgrade-plans">
              <article className="upgrade-plan">
                <header className="upgrade-plan-head">
                  <p className="eyebrow upgrade-plan-eyebrow">Premium</p>
                  <h3>
                    <span className="upgrade-price">₹99</span>
                    <span className="upgrade-price-suffix">/mo</span>
                  </h3>
                </header>
                <p className="upgrade-plan-copy">
                  Auto-renews via UPI Autopay or eMandate. Cancel anytime from
                  Settings.
                </p>
                <button
                  className="ghost-button upgrade-cta"
                  type="button"
                  onClick={checkoutMonthly}
                  disabled={busy !== null || onRecurring}
                >
                  {busy === "monthly" ? "Opening checkout…" : (
                    <>Subscribe <ArrowRightIcon width={13} height={13} /></>
                  )}
                </button>
              </article>
              <article className="upgrade-plan upgrade-plan--plus">
                <span className="upgrade-plan-badge">Recommended</span>
                <header className="upgrade-plan-head">
                  <p className="eyebrow upgrade-plan-eyebrow">Premium+</p>
                  <h3>
                    <span className="upgrade-price">₹299</span>
                    <span className="upgrade-price-suffix">/mo</span>
                  </h3>
                </header>
                {/* Credit-bonus anchor — the differentiator that earns
                    the price gap. Tabular serif numeric mirrors the
                    /settings credits balance treatment. */}
                <div className="upgrade-plan-bonus">
                  <span className="upgrade-plan-bonus-num">+200</span>
                  <div className="upgrade-plan-bonus-meta">
                    <p className="upgrade-plan-bonus-label">AI credits</p>
                    <p className="upgrade-plan-bonus-sub">
                      <em>dropped each cycle</em>
                    </p>
                  </div>
                </div>
                <p className="upgrade-plan-copy">
                  Everything in Premium, plus a fresh credit grant on every
                  renewal — never run out mid-month.
                </p>
                <button
                  className="primary-button upgrade-cta"
                  type="button"
                  onClick={checkoutPlus}
                  disabled={busy !== null}
                >
                  {busy === "plus" ? "Opening checkout…" : (
                    <>Subscribe to Premium+ <ArrowRightIcon width={13} height={13} /></>
                  )}
                </button>
              </article>
              <article className="upgrade-plan">
                <header className="upgrade-plan-head">
                  <p className="eyebrow upgrade-plan-eyebrow">30-day pass</p>
                  <h3>
                    <span className="upgrade-price">₹99</span>
                    <span className="upgrade-price-suffix">once</span>
                  </h3>
                </header>
                <p className="upgrade-plan-copy">
                  No autopay. 30 days of premium, then you choose whether to renew.
                </p>
                <button
                  className="ghost-button upgrade-cta"
                  type="button"
                  onClick={checkoutPass}
                  disabled={busy !== null}
                >
                  {busy === "pass" ? "Opening checkout…" : (
                    <>Buy a pass <ArrowRightIcon width={13} height={13} /></>
                  )}
                </button>
              </article>
            </div>
          </>
        )}

        {activePremium ? null : (
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
        )}

        <div ref={creditsRef} id="credits" />
        <h2 className="upgrade-section-title">AI credits</h2>
        <p className="muted small upgrade-section-copy">
          Top up a balance you can spend on AI cover-letter and resume tweak features.
          Credits don&apos;t expire and live separately from premium.
        </p>
        <div className="upgrade-credit-packs">
          {packs.map((p) => {
            const isBest = p.id === "plus";
            const rupees = (p.amountPaise / 100).toFixed(0);
            return (
              <article key={p.id} className={isBest ? "upgrade-credit is-best" : "upgrade-credit"}>
                {isBest ? <span className="upgrade-credit-badge">Best value</span> : null}
                <p className="eyebrow">{p.label}</p>
                <h3>
                  <span className="upgrade-credit-count">{p.credits}</span>
                  <span className="upgrade-credit-suffix">credits</span>
                </h3>
                <p className="upgrade-credit-price">₹{rupees}</p>
                <button
                  className={isBest ? "primary-button upgrade-cta" : "ghost-button upgrade-cta"}
                  type="button"
                  onClick={() => checkoutCredits(p)}
                  disabled={busy !== null}
                >
                  {busy === `credits:${p.id}` ? "Opening checkout…" : "Top up"}
                </button>
              </article>
            );
          })}
        </div>

        {error ? (
          <p className="upgrade-error">{error}</p>
        ) : null}

        <p className="muted small upgrade-fineprint">
          Pegasus stays free for the core tracker — applications, notes, resume vault,
          public profile, browser extension, in-app notifications. Premium is the email
          layer; credits are the AI-features layer.
        </p>
      </section>
    </ProductFrame>
  );
}
