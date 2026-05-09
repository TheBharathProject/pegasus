"use client";

import { useEffect, useState } from "react";
import { ProductFrame } from "@/components/frames";
import {
  CloseIcon,
  GlobeIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon
} from "@/components/icons";
import { api, type ApiUser, type ApiProfile, type ApiAPIToken } from "@/lib/api-client";
import { isAuthed, clearToken } from "@/lib/auth";
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
    Promise.all([
      api.get<ApiUser>("/job-tracker/me"),
      api.get<ApiProfile>("/job-tracker/profile")
    ])
      .then(([u, p]) => {
        setUser(u);
        setProfile(p);
      })
      .catch(() => {});
    api.get<AIUsage>("/job-tracker/ai/usage").then(setUsage).catch(() => {});
    api.get<ApiAPIToken[]>("/job-tracker/me/api-tokens").then(setApiTokens).catch(() => {});

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
              <a className="primary-button" href="/upgrade">
                Upgrade
              </a>
            </div>
          )}
        </article>

        <article className="settings-section">
          <h2>Billing</h2>
          <p className="muted small">AI features are metered. Everything else is free forever.</p>
          <div className="billing-row">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: "#2c2c2c",
                  color: "#b3b1ab"
                }}
              >
                <SettingsIcon width={14} height={14} />
              </span>
              <div>
                <strong>Pro plan</strong>
                <div className="data-title">
                  {aiUsedDisplay} of {aiLimitDisplay} AI tokens this month
                </div>
              </div>
            </div>
            <span className="pill tone-stage-offer">Active</span>
          </div>
          <button
            className="ghost-button"
            style={{ marginTop: 18 }}
            type="button"
            onClick={() => setShowCancel(true)}
          >
            Delete account
          </button>
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
            Save jobs from LinkedIn, Indeed, Naukri, or any careers page with one click. Each
            browser you install the extension on needs its own token. Tokens never expire — revoke
            one to sign that browser out.
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

          {apiTokens.length === 0 ? (
            <p className="muted small" style={{ marginTop: 14 }}>
              No tokens yet. Generate one and paste it into the extension.
            </p>
          ) : (
            <ul className="token-list" style={{ marginTop: 14 }}>
              {apiTokens.map((t) => {
                const revoked = !!t.revokedAt;
                return (
                  <li
                    key={t.id}
                    className={revoked ? "token-row is-revoked" : "token-row"}
                  >
                    <div className="token-row-main">
                      <span className="token-row-label">
                        {t.label || "(unnamed)"}
                      </span>
                      <span className="token-row-meta">
                        <code>{t.prefix}…</code>
                        <span> · created {t.createdAt.slice(0, 10)}</span>
                        {t.lastUsedAt ? (
                          <span> · last used {t.lastUsedAt.slice(0, 10)}</span>
                        ) : (
                          <span> · never used</span>
                        )}
                      </span>
                    </div>
                    {revoked ? (
                      <span className="token-row-tag">Revoked</span>
                    ) : (
                      <button
                        className="ghost-button token-row-revoke"
                        type="button"
                        onClick={() => handleRevokeToken(t.id, t.label)}
                        disabled={tokensBusy}
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
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
      </section>

      {showCancel ? (
        <div
          className="modal-backdrop"
          onClick={() => {
            setShowCancel(false);
            setDeleteConfirm("");
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460 }}
          >
            <div className="list-head">
              <h2>Delete your account?</h2>
              <button
                className="icon-button"
                aria-label="Close"
                type="button"
                onClick={() => {
                  setShowCancel(false);
                  setDeleteConfirm("");
                }}
              >
                <CloseIcon width={14} height={14} />
              </button>
            </div>
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
          </div>
        </div>
      ) : null}
    </ProductFrame>
  );
}
