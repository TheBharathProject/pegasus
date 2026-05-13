"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductFrame } from "@/components/frames";
import {
  GlobeIcon,
  HistoryIcon,
  MonitorIcon,
  MoonIcon,
  SparkleStarIcon,
  SunIcon,
  TrashIcon
} from "@/components/icons";
import { ModalShell } from "@/components/ui";
import { api, type ApiUser, type ApiProfile, type ApiAPIToken, type ApiBillingMe } from "@/lib/api-client";
import { fetchBillingMe } from "@/lib/billing";
import { getMe, isAuthed, clearToken } from "@/lib/auth";
import { goTo } from "@/lib/paths";
import {
  getStoredTheme,
  resolveTheme,
  setStoredTheme,
  watchSystemTheme,
  type ThemePref
} from "@/lib/theme";

const THEMES = [
  { key: "system", label: "System", caption: "Follows your OS", Icon: MonitorIcon },
  { key: "light", label: "Light", caption: "Always light", Icon: SunIcon },
  { key: "dark", label: "Dark", caption: "Always dark", Icon: MoonIcon }
];

type AIUsage = {
  used: number;
  limit: number;
  periodStart: string;
  periodEnd: string;
};

// renderPremiumHeadline is the bold serif title in the hero — short
// noun phrase, not a sentence. Date detail moves to the rail stamp.
function renderPremiumHeadline(p: NonNullable<ApiBillingMe["premium"]>): string {
  const isPlus = p.planTier === "plus";
  if (p.cancelAtPeriodEnd) return isPlus ? "Premium+ ending this cycle" : "Ending after this cycle";
  if (p.kind === "recurring") return isPlus ? "Premium+ monthly subscription" : "Active monthly subscription";
  return "30-day premium pass";
}

// renderPremiumTagline is the italic-serif "currently" line — adds
// connective tissue between the headline and the rail without
// repeating the date (which the stamp already shows).
function renderPremiumTagline(p: NonNullable<ApiBillingMe["premium"]>): string {
  const amount = `₹${Math.round(p.amountPaise / 100)}`;
  const isPlus = p.planTier === "plus";
  if (p.cancelAtPeriodEnd) return `${amount} · auto-renew off · keeps premium until period ends`;
  if (p.kind === "recurring") {
    return isPlus
      ? `${amount} per month · 200 credits dropped each cycle · cancel anytime`
      : `${amount} per month · UPI Autopay or eMandate · cancel anytime`;
  }
  return `${amount} once · single 30-day window · top up to extend`;
}

// dateDay extracts the numeric day from an RFC3339 / ISO date string.
// Returns "—" for malformed input so the stamp never crashes the UI.
function dateDay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return String(d.getDate()).padStart(2, "0");
}

// dateMonth returns a 3-letter month label (e.g. "May") rendered as
// the small caption beneath the day in the calendar-style stamp.
function dateMonth(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { month: "short" });
}

// formatRelative — terse human-relative time string for the
// "last used" line on extension token rows. Beyond 30 days it falls
// back to a calendar date so the timeline doesn't lie about freshness.
function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  const ms = Date.now() - d.getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  if (day < 30) {
    const w = Math.round(day / 7);
    return `${w} week${w === 1 ? "" : "s"} ago`;
  }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// formatActivityDate renders an RFC3339 timestamp as e.g. "9 May 2026".
// We use English ordering so it reads naturally to the user's eye even
// when their locale defaults differ.
function formatActivityDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

// formatActivityAmount turns the (kind, amount) tuple into a human
// monetary string. The backend's `amount` is paise for subscriptions
// and a synthetic delta×100 for credits — for credits we display the
// delta as a count, for subscriptions the rupee amount.
function formatActivityAmount(kind: ApiBillingMe["recentActivity"][number]["kind"], amount: number): string {
  if (kind === "credits") {
    const delta = Math.round(amount / 100);
    if (delta > 0) return `+${delta} credits`;
    return `${delta} credits`;
  }
  const rupees = Math.round(amount / 100);
  return rupees > 0 ? `₹${rupees}` : "—";
}

export default function SettingsPage() {
  const [theme, setThemeState] = useState<ThemePref>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  // Read the stored choice + resolved value once on mount. Boot script in
  // app/layout.tsx already applied the theme before paint; this just brings
  // the React state into sync.
  useEffect(() => {
    const pref = getStoredTheme();
    setThemeState(pref);
    setResolvedTheme(resolveTheme(pref));
  }, []);

  // While "system" is selected, follow OS changes live.
  useEffect(() => {
    if (theme !== "system") return;
    return watchSystemTheme(() => {
      const r = resolveTheme("system");
      setResolvedTheme(r);
      // Re-apply via setStoredTheme so data-theme attr matches.
      setStoredTheme("system");
    });
  }, [theme]);

  const handleThemeChoice = (key: ThemePref) => {
    setThemeState(key);
    setStoredTheme(key);
    setResolvedTheme(resolveTheme(key));
  };
  const [user, setUser] = useState<ApiUser | null>(null);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [feedback, setFeedback] = useState("");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenLabel, setTokenLabel] = useState("");
  const [apiTokens, setApiTokens] = useState<ApiAPIToken[]>([]);
  const [tokensBusy, setTokensBusy] = useState(false);
  // Billing snapshot — loaded from GET /billing/me on mount. Null while
  // loading; the page renders skeleton copy until then.
  const [billing, setBilling] = useState<ApiBillingMe | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  // History panel is collapsed by default — clicking the clock icon in
  // the Billing header expands the recent-activity timeline.
  const [historyOpen, setHistoryOpen] = useState(false);
  // Detected by reading <html data-pegasus-extension="1">, set by the
  // extension's pegasus_bridge content script. Lets us show "Send to
  // extension" instead of forcing copy/paste.
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [showCancel, setShowCancel] = useState(false);
  const [showFeedbackOk, setShowFeedbackOk] = useState(false);

  // Slug edit state — inline input that replaces the static <code>{profileUrl}</code>
  // when "Update URL" is clicked. Live availability is checked as the user types
  // via GET /profile/slug/check.
  const [slugEditing, setSlugEditing] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const [slugCheck, setSlugCheck] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid" | "same"
  >("idle");

  // Delete-account modal state. Requires the user to type "delete" before
  // the destructive button enables — small friction in front of an
  // irreversible action.
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !isAuthed()) {
      goTo("/login");
      return;
    }
    // /me routes through the shared cache (lib/auth) so settings doesn't
    // re-fetch on every mount when the sidebar already has it.
    Promise.all([
      getMe(),
      api.get<ApiProfile>("/job-tracker/profile")
    ])
      .then(([u, p]) => {
        if (u) setUser(u as ApiUser);
        setProfile(p);
      })
      .catch(() => {});
    api.get<AIUsage>("/job-tracker/ai/usage").then(setUsage).catch(() => {});
    api.get<ApiAPIToken[]>("/job-tracker/me/api-tokens").then(setApiTokens).catch(() => {});
    // Route through the cached fetcher so Upgrade + Sidebar + AI dialogs
    // share one request within the TTL window (the §8.2 over-fetch fix).
    fetchBillingMe().then(setBilling).catch(() => {});

    // Detect the extension. The content script runs at document_start
    // and stamps the marker before React mounts, so a single read is
    // enough — no polling needed. Re-check once after a tick anyway in
    // case the extension is enabled mid-session.
    const detect = () => {
      setExtensionInstalled(
        typeof document !== "undefined" &&
          document.documentElement.dataset.pegasusExtension === "1"
      );
    };
    detect();
    const t = setTimeout(detect, 200);
    return () => clearTimeout(t);
  }, []);

  const profileUrl = profile?.slug ? `sypher.in/u/${profile.slug}` : "(set a slug below)";

  const handleCopy = (value: string) => {
    if (typeof window === "undefined") return;
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopyStatus("Copied");
        setTimeout(() => setCopyStatus(null), 1800);
      },
      () => setCopyStatus("Copy failed")
    );
  };

  const refreshTokens = async () => {
    try {
      const list = await api.get<ApiAPIToken[]>("/job-tracker/me/api-tokens");
      setApiTokens(list);
    } catch {
      // List failures don't need to surface — the next page load will retry.
    }
  };

  const handleGenerateToken = async () => {
    if (tokensBusy) return;
    const label = tokenLabel.trim();
    if (!label) {
      window.alert("Give the token a label (e.g. 'Chrome on laptop') so you can find it later.");
      return;
    }
    setTokensBusy(true);
    setSendStatus("idle");
    try {
      const resp = await api.post<{ token: string }>("/job-tracker/me/api-token", { label });
      setToken(resp.token);
      setTokenLabel("");
      await refreshTokens();
      // If the extension is detected, push the token straight in. The
      // user still sees the reveal pane briefly so they know it landed,
      // and the pane auto-closes on success.
      if (extensionInstalled) {
        handleSendTokenToExtension(resp.token);
      }
    } catch (e) {
      window.alert(`Could not generate token: ${(e as Error).message}`);
    } finally {
      setTokensBusy(false);
    }
  };

  // /upgrade redirects here with ?billing=<message> after a successful
  // checkout. The webhook updates state asynchronously so we re-fetch
  // /billing/me after a short delay to give Razorpay time to deliver.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const msg = url.searchParams.get("billing");
    if (!msg) return;
    // Strip the param so a refresh doesn't re-show the toast.
    url.searchParams.delete("billing");
    window.history.replaceState({}, "", url.toString());
    setCopyStatus(msg);
    setTimeout(() => setCopyStatus(null), 4000);
    // Webhook usually lands within a second or two; refresh /billing/me
    // a moment later so the section reflects the new state. Bypass cache
    // because we know it's stale post-checkout.
    setTimeout(() => {
      fetchBillingMe({ force: true }).then(setBilling).catch(() => {});
    }, 1500);
  }, []);

  // CancelSubscriptionModal state. window.confirm doesn't fit the
  // app's modal language and skips period-end context; this dialog
  // shows the date premium will lapse + what stays accessible.
  const [showCancelModal, setShowCancelModal] = useState(false);

  const handleCancelSubscription = async () => {
    if (!billing?.premium || billing.premium.kind !== "recurring") return;
    setBillingBusy(true);
    try {
      await api.post(`/billing/subscriptions/${billing.premium.id}/cancel`, {});
      const fresh = await fetchBillingMe({ force: true });
      setBilling(fresh);
      setShowCancelModal(false);
    } catch (e) {
      window.alert(`Cancel failed: ${(e as Error).message}`);
    } finally {
      setBillingBusy(false);
    }
  };

  const handleSendTokenToExtension = (plain: string) => {
    if (!extensionInstalled) return;
    setSendStatus("sending");

    // One-shot listener — the bridge posts back a result with the same
    // origin. We strip the listener whether it succeeds or times out so
    // a future generate-token cycle starts clean.
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as { type?: string; ok?: boolean } | null;
      if (!data || data.type !== "pegasus:set-token-result") return;
      window.removeEventListener("message", onMessage);
      clearTimeout(timeoutId);
      setSendStatus(data.ok ? "sent" : "failed");
      if (data.ok) {
        // The token is now in the extension; user no longer needs the
        // plaintext shown. Auto-collapse the reveal pane after a beat
        // so the success message has time to register.
        setTimeout(() => {
          setToken(null);
          setSendStatus("idle");
        }, 1800);
      }
    };
    const timeoutId = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      setSendStatus("failed");
    }, 3000);

    window.addEventListener("message", onMessage);
    window.postMessage({ type: "pegasus:set-token", token: plain }, window.location.origin);
  };

  const handleRevokeToken = async (id: string, label?: string) => {
    const ok = window.confirm(
      `Revoke ${label ? `"${label}"` : "this token"}? Any browser using it will be signed out immediately.`
    );
    if (!ok) return;
    setTokensBusy(true);
    try {
      await api.delete(`/job-tracker/me/api-tokens/${id}`);
      await refreshTokens();
    } catch (e) {
      window.alert(`Revoke failed: ${(e as Error).message}`);
    } finally {
      setTokensBusy(false);
    }
  };

  const handleSendFeedback = async () => {
    if (!feedback.trim()) return;
    try {
      await api.post("/job-tracker/feedback", {
        message: feedback,
        context: { page: "settings" }
      });
      setFeedback("");
      setShowFeedbackOk(true);
      setTimeout(() => setShowFeedbackOk(false), 2400);
    } catch (e) {
      window.alert(`Send failed: ${(e as Error).message}`);
    }
  };

  const handleToggleVisibility = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = !e.target.checked; // checkbox is "Hide"; public = !checked
    try {
      const updated = await api.patch<ApiProfile>("/job-tracker/profile/visibility", {
        isPublic: next
      });
      setProfile(updated);
    } catch (err) {
      window.alert(`Update failed: ${(err as Error).message}`);
    }
  };

  const startSlugEdit = () => {
    setSlugDraft(profile?.slug ?? "");
    setSlugCheck("same");
    setSlugEditing(true);
  };

  const cancelSlugEdit = () => {
    setSlugEditing(false);
    setSlugDraft("");
    setSlugCheck("idle");
  };

  const handleSaveSlug = async () => {
    if (slugCheck !== "available") return;
    try {
      const updated = await api.patch<ApiProfile>("/job-tracker/profile/slug", {
        slug: slugDraft
      });
      setProfile(updated);
      setSlugEditing(false);
      setSlugCheck("idle");
    } catch (e) {
      window.alert(`Update failed: ${(e as Error).message}`);
    }
  };

  // Debounced live availability check. Runs only while editing — kicks off
  // after 350ms of input idle, cancels on rapid typing.
  useEffect(() => {
    if (!slugEditing) return;
    const trimmed = slugDraft.trim().toLowerCase();
    if (trimmed === (profile?.slug ?? "")) {
      setSlugCheck("same");
      return;
    }
    if (!/^[a-z0-9-]{3,40}$/.test(trimmed)) {
      setSlugCheck("invalid");
      return;
    }
    setSlugCheck("checking");
    const t = setTimeout(async () => {
      try {
        const res = await api.get<{ slug: string; available: boolean }>(
          `/job-tracker/profile/slug/check?slug=${encodeURIComponent(trimmed)}`
        );
        // Guard against late responses landing after the user typed more.
        setSlugCheck((curr) =>
          curr === "checking" && res.slug === trimmed
            ? res.available
              ? "available"
              : "taken"
            : curr
        );
      } catch {
        setSlugCheck("invalid");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [slugDraft, slugEditing, profile?.slug]);

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toLowerCase() !== "delete" || deleting) return;
    setDeleting(true);
    try {
      await api.post("/job-tracker/me/delete");
      clearToken();
      // Land on the apex (escapes /pegasus). Account is gone, no point
      // bouncing them to a tool surface that'll just kick them to /login.
      window.location.href = "/";
    } catch (e) {
      setDeleting(false);
      window.alert(`Delete failed: ${(e as Error).message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    clearToken();
    // Land on the sypher.in apex (escapes basePath /pegasus on purpose).
    window.location.href = "/";
  };

  // Email opt-in toggle. Premium-gated: free users never see the toggle
  // (Upgrade CTA renders instead), and the API independently enforces a
  // 402 if a free user POSTs enabled=true. See ADR-002 (D2/D4).
  const [savingEmailPref, setSavingEmailPref] = useState(false);
  const handleEmailPrefToggle = async (next: boolean) => {
    if (savingEmailPref) return;
    setSavingEmailPref(true);
    try {
      const updated = await api.patch<ApiUser>("/job-tracker/me/email-prefs", {
        enabled: next
      });
      setUser(updated);
    } catch (e) {
      window.alert(`Could not update preference: ${(e as Error).message}`);
    } finally {
      setSavingEmailPref(false);
    }
  };

  const aiUsedDisplay = usage ? usage.used.toLocaleString() : "—";
  const aiLimitDisplay = usage && usage.limit > 0 ? usage.limit.toLocaleString() : "—";

  return (
    <ProductFrame active="settings" title="Settings" intro="The small dials.">
      <section className="settings-stack">
        <article className="settings-section">
          <h2>Account</h2>
          <dl className="definition-grid">
            <span className="info-key">Name</span>
            <strong>{user?.name ?? "…"}</strong>
            <span className="info-key">Email</span>
            <strong>{user?.email ?? "…"}</strong>
            <span className="info-key">Timezone</span>
            <strong>{user?.timezone ?? "…"}</strong>
          </dl>
          <button
            className="ghost-button"
            style={{ marginTop: 14 }}
            type="button"
            onClick={handleLogout}
          >
            Sign out
          </button>
        </article>

        <article className="settings-section">
          <h2>Appearance</h2>
          <p className="muted small">
            Currently showing <strong style={{ color: "var(--text)" }}>{resolvedTheme}</strong>
            {theme === "system" ? " (matched from your system)" : ""}.
          </p>
          <div className="theme-grid">
            {THEMES.map(({ key, label, caption, Icon }) => (
              <button
                key={key}
                className={theme === key ? "theme-option active" : "theme-option"}
                onClick={() => handleThemeChoice(key as ThemePref)}
                type="button"
              >
                <span className="theme-icon">
                  <Icon />
                </span>
                <span className="theme-text">
                  <strong>{label}</strong>
                  <span>{caption}</span>
                </span>
              </button>
            ))}
          </div>
        </article>

        <article className="settings-section">
          <h2>Email notifications</h2>
          <p className="muted small">
            In-app notifications are free for everyone. Email digests +
            community-reply nudges are a premium perk.
          </p>
          {user?.isPremium ? (
            <label className="email-pref-row">
              <input
                type="checkbox"
                checked={user?.emailNotificationsEnabled ?? false}
                disabled={savingEmailPref}
                onChange={(e) => handleEmailPrefToggle(e.target.checked)}
              />
              <span>
                <strong>Email me about activity</strong>
                <span className="muted small">
                  Daily digest at 09:00 IST and replies on your community posts.
                </span>
              </span>
            </label>
          ) : (
            <div className="email-pref-upgrade">
              <div>
                <strong>Email digest is a Premium feature</strong>
                <p className="muted small">
                  Pegasus quietly emails you only when there&apos;s a reason — stale
                  applications, approaching deadlines, replies on what you posted.
                </p>
              </div>
              <Link className="primary-button" href="/upgrade">
                Upgrade
              </Link>
            </div>
          )}
        </article>

        <article className="settings-section billing-section">
          <header className="billing-head">
            <div>
              <h2>Billing</h2>
              <p className="muted small billing-intro">
                Premium gives you the email layer. Credits power the AI features.
                Everything else stays free forever.
              </p>
            </div>
            <button
              type="button"
              className={historyOpen ? "billing-history-toggle is-open" : "billing-history-toggle"}
              onClick={() => setHistoryOpen((v) => !v)}
              aria-expanded={historyOpen}
              aria-controls="billing-history-panel"
              title={historyOpen ? "Hide billing history" : "Show billing history"}
            >
              <HistoryIcon width={15} height={15} />
              <span>{historyOpen ? "Hide history" : "History"}</span>
            </button>
          </header>

          {/* Premium status — hero card. Asymmetric inner grid:
              left rail carries the editorial copy (eyebrow + serif title
              + italic "currently" tagline); right rail is a calendar-
              style date stamp when there's a renewal, or a CTA when free.
              Decorative ₹ mark sits behind the title at low opacity. */}
          <div className={billing?.premium ? "billing-hero is-premium" : "billing-hero"}>
            <div aria-hidden className="billing-hero-mark">₹</div>
            <div className="billing-hero-main">
              <p className="eyebrow">{billing?.premium ? "Pegasus Premium" : "Pegasus Free"}</p>
              <h3 className="billing-hero-title">
                {!billing
                  ? "Loading…"
                  : billing.premium
                  ? renderPremiumHeadline(billing.premium)
                  : "Email digest locked"}
              </h3>
              <p className="billing-hero-tagline">
                <em>currently</em> —{" "}
                {!billing
                  ? "fetching your billing details"
                  : billing.premium
                  ? renderPremiumTagline(billing.premium)
                  : "free tier · upgrade for inbox digest + community reply emails"}
              </p>
            </div>
            <aside className="billing-hero-rail">
              {billing?.premium && billing.premium.currentPeriodEnd ? (
                <div
                  className={
                    billing.premium.cancelAtPeriodEnd
                      ? "billing-stamp is-ending"
                      : "billing-stamp"
                  }
                >
                  <p className="billing-stamp-eyebrow">
                    {billing.premium.cancelAtPeriodEnd
                      ? "Ends"
                      : billing.premium.kind === "recurring"
                      ? "Renews"
                      : "Expires"}
                  </p>
                  <p className="billing-stamp-day">
                    {dateDay(billing.premium.currentPeriodEnd)}
                  </p>
                  <p className="billing-stamp-month">
                    {dateMonth(billing.premium.currentPeriodEnd)}
                  </p>
                  <p className="billing-stamp-meta">
                    ₹{Math.round(billing.premium.amountPaise / 100)} ·{" "}
                    {billing.premium.kind === "recurring" ? "Autopay" : "One-time"}
                  </p>
                </div>
              ) : !billing?.premium ? (
                <Link className="primary-button billing-cta" href="/upgrade">
                  Upgrade
                </Link>
              ) : null}
              {billing?.premium && billing.premium.kind === "recurring" && !billing.premium.cancelAtPeriodEnd ? (
                <button
                  className="billing-link-btn"
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  disabled={billingBusy}
                >
                  Cancel auto-renewal
                </button>
              ) : null}
            </aside>
          </div>

          {/* Credits balance — display-typography first.
              Big serif numeral (tabular) carries visual weight; the
              token meter beside it shows monthly AI consumption as a
              hairline progress bar so it reads as one cohesive panel
              rather than two separate stats stapled together. */}
          <div className="billing-credits-card">
            <div className="billing-credits-figure">
              <span aria-hidden className="billing-credits-spark">
                <SparkleStarIcon width={14} height={14} />
              </span>
              <div className="billing-credits-numeric">
                <p className="billing-credits-value">
                  {(billing?.creditsBalance ?? 0).toLocaleString("en-IN")}
                </p>
                <p className="billing-credits-label">
                  paid <em>credits</em> · never expire
                </p>
              </div>
            </div>

            <div className="billing-tokens">
              <p className="billing-tokens-eyebrow">Free AI tokens · this month</p>
              <div
                className="billing-tokens-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={usage?.limit ?? 0}
                aria-valuenow={usage?.used ?? 0}
              >
                <span
                  className="billing-tokens-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(((usage?.used ?? 0) / Math.max(1, usage?.limit ?? 1)) * 100)
                    )}%`
                  }}
                />
              </div>
              <p className="billing-tokens-caption">
                <span className="billing-tokens-used">{aiUsedDisplay}</span>
                <span className="billing-tokens-divider"> / </span>
                <span className="billing-tokens-limit">{aiLimitDisplay}</span>
              </p>
            </div>

            <Link className="ghost-button billing-cta" href="/upgrade#credits">
              Top up
            </Link>
          </div>

          {/* Collapsible history panel */}
          {historyOpen ? (
            <section
              id="billing-history-panel"
              className="billing-history"
              aria-label="Billing history"
            >
              <p className="eyebrow">History</p>
              {billing && billing.recentActivity.length > 0 ? (
                <ol className="billing-timeline">
                  {billing.recentActivity.map((row, i) => {
                    const positive = row.kind === "credits" && row.amount > 0;
                    const negative = row.kind === "credits" && row.amount < 0;
                    return (
                      <li
                        key={i}
                        className="billing-timeline-item"
                        style={{ animationDelay: `${Math.min(i, 5) * 60}ms` }}
                      >
                        <p className="billing-timeline-stamp">
                          <span className="billing-timeline-day">
                            {row.when ? dateDay(row.when) : "—"}
                          </span>
                          <span className="billing-timeline-mon">
                            {row.when ? dateMonth(row.when) : ""}
                          </span>
                        </p>
                        <div className="billing-timeline-body">
                          <p className="billing-timeline-summary">
                            <span
                              aria-hidden
                              className={
                                row.kind === "credits"
                                  ? "billing-timeline-glyph is-credits"
                                  : "billing-timeline-glyph is-sub"
                              }
                            >
                              {row.kind === "credits" ? "✦" : "◉"}
                            </span>
                            {row.summary}
                          </p>
                          <p className="billing-timeline-meta">
                            {row.kind === "credits" ? "Credits" : "Premium"}
                          </p>
                        </div>
                        <p
                          className={
                            positive
                              ? "billing-timeline-amount is-positive"
                              : negative
                              ? "billing-timeline-amount is-negative"
                              : "billing-timeline-amount"
                          }
                        >
                          {formatActivityAmount(row.kind, row.amount)}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="muted small">
                  No transactions yet. Once you upgrade or top up, your activity
                  appears here.
                </p>
              )}
            </section>
          ) : null}
        </article>

        <article className="settings-section">
          <h2 style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <GlobeIcon width={18} height={18} /> Profile
          </h2>

          {slugEditing ? (
            <div style={{ marginTop: 14 }}>
              <div className="slug-edit-row">
                <span className="slug-edit-prefix">sypher.in/u/</span>
                <input
                  className="slug-edit-input"
                  value={slugDraft}
                  onChange={(e) =>
                    setSlugDraft(e.target.value.toLowerCase().replace(/\s+/g, ""))
                  }
                  placeholder="your-slug"
                  autoFocus
                  spellCheck={false}
                />
              </div>
              <p className={`slug-status slug-status--${slugCheck}`}>
                {slugCheck === "checking" && "Checking…"}
                {slugCheck === "available" && "Available"}
                {slugCheck === "taken" && "Taken"}
                {slugCheck === "invalid" &&
                  "Use 3–40 characters: lowercase a–z, 0–9, dash"}
                {slugCheck === "same" && "This is your current URL"}
                {slugCheck === "idle" && " "}
              </p>
              <div className="section-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleSaveSlug}
                  disabled={slugCheck !== "available"}
                >
                  Save
                </button>
                <button className="ghost-button" type="button" onClick={cancelSlugEdit}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p style={{ marginTop: 14 }}>
                <code>{profileUrl}</code>
              </p>
              <div className="section-actions">
                <button
                  className="ghost-button"
                  type="button"
                  disabled={!profile?.slug}
                  onClick={() => handleCopy("https://" + profileUrl)}
                >
                  {copyStatus ?? "Copy"}
                </button>
                <a
                  className="ghost-button"
                  href={profile?.slug ? `/u/${profile.slug}` : "#"}
                  target="_blank"
                  rel="noreferrer"
                >
                  Preview
                </a>
                <button className="ghost-button" type="button" onClick={startSlugEdit}>
                  Update URL
                </button>
                <label className="ghost-button" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={!profile?.isPublic}
                    onChange={handleToggleVisibility}
                  />{" "}
                  Hide
                </label>
              </div>
            </>
          )}
        </article>

        <article className="settings-section">
          <h2>Browser extension</h2>
          <p className="muted small">
            Save jobs from LinkedIn, Instahyre, Naukri or any careers page with one click. Each
            browser you install the extension on needs its own token. Tokens never expire — revoke
            one to sign that browser out.{" "}
            <a
              href="https://chromewebstore.google.com/detail/pegasus-%E2%80%94-job-clipper/oghjgddbopcpgdbpgijkkaabiaebedgp"
              target="_blank"
              rel="noopener noreferrer"
            >
              Install from Chrome Web Store →
            </a>
          </p>
          {extensionInstalled ? (
            <p className="extension-detected small">
              <span className="extension-detected-dot" /> Extension detected in this browser —
              new tokens will be handed off automatically.
            </p>
          ) : null}

          {token ? (
            <div className="token-reveal">
              <p className="eyebrow">
                {sendStatus === "sent"
                  ? "Sent to extension"
                  : sendStatus === "sending"
                  ? "Handing off to extension…"
                  : "Token created"}
              </p>
              <p className="token-reveal-copy">
                {sendStatus === "sent"
                  ? "The extension has the token. Open its side panel — you should be signed in."
                  : extensionInstalled
                  ? "We're dropping this straight into your extension. If anything goes wrong, you can copy it manually below."
                  : "Copy this now — for your security we won't show it again. Paste it into the extension's Connect screen."}
              </p>
              <div className="token-reveal-row">
                <code className="token-reveal-value">{token}</code>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => handleCopy(token)}
                >
                  {copyStatus ?? "Copy"}
                </button>
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center"
                }}
              >
                {extensionInstalled && sendStatus !== "sent" ? (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => handleSendTokenToExtension(token)}
                    disabled={sendStatus === "sending"}
                  >
                    {sendStatus === "sending" ? "Sending…" :
                     sendStatus === "failed" ? "Retry send" :
                     "Send to extension"}
                  </button>
                ) : null}
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setToken(null);
                    setSendStatus("idle");
                  }}
                >
                  {sendStatus === "sent" ? "Close" : "Done — I've copied it"}
                </button>
                {sendStatus === "failed" ? (
                  <span className="muted small">
                    Send didn't reach the extension — copy/paste still works.
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="token-form" style={{ marginTop: token ? 18 : 12 }}>
            <input
              type="text"
              className="token-label-input"
              placeholder="Token label, e.g. 'Chrome on laptop'"
              value={tokenLabel}
              onChange={(e) => setTokenLabel(e.target.value.slice(0, 80))}
              disabled={tokensBusy}
            />
            <button
              className="primary-button"
              type="button"
              onClick={handleGenerateToken}
              disabled={tokensBusy || !tokenLabel.trim()}
            >
              {tokensBusy ? "Generating…" : "Generate token"}
            </button>
          </div>

          {(() => {
            const active = apiTokens.filter((t) => !t.revokedAt);
            const revoked = apiTokens.filter((t) => !!t.revokedAt);
            return (
              <>
                {/* Active tokens — visible by default. The empty state
                    leans on serif italic to feel intentional rather
                    than placeholder-y. */}
                {active.length === 0 ? (
                  <p className="ext-token-empty">
                    <em>No active tokens.</em> Name a browser above and generate one
                    — it&apos;ll appear here once you&apos;ve connected the extension.
                  </p>
                ) : (
                  <ul className="ext-token-list">
                    {active.map((t, i) => (
                      <li
                        key={t.id}
                        className="ext-token-row"
                        style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}
                      >
                        <p className="ext-token-stamp">
                          <span className="ext-token-day">{dateDay(t.createdAt)}</span>
                          <span className="ext-token-mon">{dateMonth(t.createdAt)}</span>
                        </p>
                        <div className="ext-token-body">
                          <p className="ext-token-label">
                            {t.label?.trim() || "Unnamed token"}
                          </p>
                          <p className="ext-token-meta">
                            <code className="ext-token-prefix">{t.prefix}…</code>
                            <span aria-hidden className="ext-token-sep">·</span>
                            <span className="ext-token-when">
                              {t.lastUsedAt
                                ? `Last used ${formatRelative(t.lastUsedAt)}`
                                : "Never used"}
                            </span>
                          </p>
                        </div>
                        <button
                          className="ext-token-revoke"
                          type="button"
                          onClick={() => handleRevokeToken(t.id, t.label)}
                          disabled={tokensBusy}
                        >
                          Revoke
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Revoked tokens collapsed under a disclosure — they're
                    audit trail, not the working set. */}
                {revoked.length > 0 ? (
                  <details className="ext-revoked-group">
                    <summary>
                      <span>
                        {revoked.length} revoked token
                        {revoked.length === 1 ? "" : "s"}
                      </span>
                      <span className="ext-revoked-hint">show</span>
                    </summary>
                    <ul className="ext-token-list ext-token-list--revoked">
                      {revoked.map((t) => (
                        <li
                          key={t.id}
                          className="ext-token-row ext-token-row--revoked"
                        >
                          <p className="ext-token-stamp">
                            <span className="ext-token-day">{dateDay(t.createdAt)}</span>
                            <span className="ext-token-mon">{dateMonth(t.createdAt)}</span>
                          </p>
                          <div className="ext-token-body">
                            <p className="ext-token-label">
                              {t.label?.trim() || "Unnamed token"}
                            </p>
                            <p className="ext-token-meta">
                              <code className="ext-token-prefix">{t.prefix}…</code>
                              <span aria-hidden className="ext-token-sep">·</span>
                              <span className="ext-token-when">
                                Revoked{" "}
                                {t.revokedAt ? formatRelative(t.revokedAt) : "earlier"}
                              </span>
                            </p>
                          </div>
                          <span className="ext-token-tag">Revoked</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </>
            );
          })()}
        </article>

        <article className="settings-section">
          <h2>Tell us what you need</h2>
          <p className="muted small">Bug, idea, or anything missing — we read every one.</p>
          <textarea
            className="feedback-box"
            placeholder="What would make this better for you?"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <button
            className="primary-button"
            style={{ marginTop: 12 }}
            type="button"
            onClick={handleSendFeedback}
          >
            Send
          </button>
          {showFeedbackOk ? (
            <p className="muted small" style={{ marginTop: 10, color: "#62c18b" }}>
              Thanks — your note has been sent.
            </p>
          ) : null}
        </article>

        <article className="settings-section settings-danger">
          <header className="settings-danger-head">
            <p className="eyebrow">Danger zone</p>
            <h2>Delete account</h2>
          </header>
          <p className="muted small settings-danger-copy">
            Permanently removes your applications, notes, resume vault, community
            posts, billing rows, and identity. This cannot be undone — there&apos;s no
            grace period and no recovery.
          </p>
          <button
            className="settings-danger-btn"
            type="button"
            onClick={() => setShowCancel(true)}
          >
            <TrashIcon width={13} height={13} /> Delete my account
          </button>
        </article>
      </section>

      <ModalShell
        open={showCancel}
        onClose={() => {
          setShowCancel(false);
          setDeleteConfirm("");
        }}
        title="Delete your account?"
        titleId="delete-account-title"
        width="460px"
      >
        <p
          className="muted"
          style={{
            marginTop: 12,
            fontFamily: "var(--font-serif-stack)",
            fontStyle: "italic"
          }}
        >
          This wipes every application, note, resume, and profile field tied to
          your account. Cannot be undone. Your sign-in (Google) stays — you can
          start over later if you want, but the data is gone.
        </p>
        <div className="field" style={{ marginTop: 18 }}>
          <label>Type <strong>delete</strong> to confirm</label>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="delete"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="section-actions" style={{ justifyContent: "flex-end" }}>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              setShowCancel(false);
              setDeleteConfirm("");
            }}
          >
            Keep account
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={handleDeleteAccount}
            disabled={
              deleteConfirm.trim().toLowerCase() !== "delete" || deleting
            }
          >
            {deleting ? "Deleting…" : "Delete forever"}
          </button>
        </div>
      </ModalShell>

      {/* Cancel-subscription confirmation modal. Surfaces the
          period-end date so the user knows exactly when premium lapses,
          and frames "what stays accessible" so cancellation feels less
          like a cliff. Replaces the prior window.confirm. */}
      <ModalShell
        open={showCancelModal && !!billing?.premium && billing.premium.kind === "recurring"}
        onClose={() => setShowCancelModal(false)}
        title="Cancel auto-renewal?"
        titleId="cancel-sub-title"
        width="480px"
      >
        {billing?.premium && billing.premium.kind === "recurring" ? (
          <>
            <p
              className="muted"
              style={{
                marginTop: 12,
                fontFamily: "var(--font-serif-stack)",
                fontStyle: "italic"
              }}
            >
              Your premium features keep working until
              {" "}
              <strong>
                {billing.premium.currentPeriodEnd
                  ? new Date(billing.premium.currentPeriodEnd).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric"
                    })
                  : "the end of your current period"}
              </strong>
              . After that, the account stays — applications, notes, resumes,
              and credits all remain — but auto-renewal stops and premium-only
              features (email digest, etc.) turn off.
            </p>
            <p className="muted small" style={{ marginTop: 12 }}>
              Razorpay won&apos;t charge your card again unless you re-subscribe.
              Existing credits never expire.
            </p>
            <div className="section-actions" style={{ justifyContent: "flex-end", marginTop: 16 }}>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={billingBusy}
              >
                Keep subscription
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={handleCancelSubscription}
                disabled={billingBusy}
              >
                {billingBusy ? "Cancelling…" : "Cancel auto-renewal"}
              </button>
            </div>
          </>
        ) : null}
      </ModalShell>
    </ProductFrame>
  );
}
