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
import { api, type ApiUser, type ApiProfile } from "@/lib/api-client";
import { isAuthed, clearToken } from "@/lib/auth";
import { goTo } from "@/lib/paths";

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
  const [theme, setTheme] = useState<string>("system");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [feedback, setFeedback] = useState("");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showFeedbackOk, setShowFeedbackOk] = useState(false);

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

  const handleGenerateToken = async () => {
    try {
      const resp = await api.post<{ token: string }>("/job-tracker/me/api-token", {});
      setToken(resp.token);
    } catch (e) {
      window.alert(`Could not generate token: ${(e as Error).message}`);
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

  const handleUpdateSlug = async () => {
    const slug = window.prompt(
      "New profile URL slug (lowercase a-z, 0-9, dash)",
      profile?.slug || ""
    );
    if (!slug) return;
    try {
      const updated = await api.patch<ApiProfile>("/job-tracker/profile/slug", { slug });
      setProfile(updated);
    } catch (e) {
      window.alert(`Update failed: ${(e as Error).message}`);
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
            Currently showing <strong style={{ color: "#ececea" }}>{theme === "system" ? "dark" : theme}</strong>{" "}
            (matched from your system).
          </p>
          <div className="theme-grid">
            {THEMES.map(({ key, label, caption, Icon }) => (
              <button
                key={key}
                className={theme === key ? "theme-option active" : "theme-option"}
                onClick={() => setTheme(key)}
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
            Cancel subscription
          </button>
        </article>

        <article className="settings-section">
          <h2 style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <GlobeIcon width={18} height={18} /> Profile
          </h2>
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
            <button className="ghost-button" type="button" onClick={handleUpdateSlug}>
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
        </article>

        <article className="settings-section">
          <h2>Chrome Extension</h2>
          <p className="muted small">
            Save jobs from LinkedIn, Indeed, Naukri, or any careers page with one click. Generate a
            token below and paste it into the extension.
          </p>
          <div className="section-actions">
            <button className="primary-button" type="button" onClick={handleGenerateToken}>
              Generate Extension Token
            </button>
          </div>
          {token ? (
            <div className="billing-row" style={{ marginTop: 16 }}>
              <code style={{ fontSize: 13, color: "#ececea", wordBreak: "break-all" }}>{token}</code>
              <button className="ghost-button" type="button" onClick={() => handleCopy(token)}>
                {copyStatus ?? "Copy"}
              </button>
            </div>
          ) : null}
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
        <div className="modal-backdrop" onClick={() => setShowCancel(false)} role="dialog" aria-modal="true">
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="list-head">
              <h2>Cancel subscription?</h2>
              <button
                className="icon-button"
                aria-label="Close"
                type="button"
                onClick={() => setShowCancel(false)}
              >
                <CloseIcon width={14} height={14} />
              </button>
            </div>
            <p className="muted" style={{ marginTop: 12, fontFamily: "var(--font-serif-stack)", fontStyle: "italic" }}>
              You&apos;ll keep Pro until the end of this billing period, then drop to the free plan.
            </p>
            <div className="section-actions" style={{ justifyContent: "flex-end" }}>
              <button className="ghost-button" type="button" onClick={() => setShowCancel(false)}>
                Keep Pro
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setShowCancel(false);
                  window.alert("Subscription cancellation queued (demo).");
                }}
              >
                Cancel anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ProductFrame>
  );
}
