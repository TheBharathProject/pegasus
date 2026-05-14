"use client";

import type { ApiDraftPersonal } from "@/lib/api-client";

// Personal — the resume's header block. Name is the only required field
// from a UX standpoint (LaTeX will compile with empty optional fields).

export function SectionPersonal({
  value,
  onChange
}: {
  value: ApiDraftPersonal;
  onChange: (next: ApiDraftPersonal) => void;
}) {
  const set = <K extends keyof ApiDraftPersonal>(key: K, v: ApiDraftPersonal[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <section className="rb-section" id="rb-jump-personal">
      <header className="rb-section-head">
        <span className="rb-section-eyebrow" aria-hidden>02</span>
        <h3>Personal</h3>
      </header>
      <div className="form-grid">
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Full name <span style={{ color: "var(--danger)" }}>*</span></label>
          <input
            type="text"
            placeholder="Anya Sharma"
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Headline</label>
          <input
            type="text"
            placeholder="Senior Software Engineer · Backend"
            value={value.headline ?? ""}
            onChange={(e) => set("headline", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            placeholder="anya@example.com"
            value={value.email ?? ""}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Phone</label>
          <input
            type="tel"
            placeholder="+91 98765 43210"
            value={value.phone ?? ""}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Location</label>
          <input
            type="text"
            placeholder="Bengaluru, IN"
            value={value.location ?? ""}
            onChange={(e) => set("location", e.target.value)}
          />
        </div>
        <div className="field">
          <label>LinkedIn URL</label>
          <input
            type="url"
            placeholder="https://linkedin.com/in/…"
            value={value.linkedinUrl ?? ""}
            onChange={(e) => set("linkedinUrl", e.target.value)}
          />
        </div>
        <div className="field">
          <label>GitHub URL</label>
          <input
            type="url"
            placeholder="https://github.com/…"
            value={value.githubUrl ?? ""}
            onChange={(e) => set("githubUrl", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Website</label>
          <input
            type="url"
            placeholder="https://…"
            value={value.websiteUrl ?? ""}
            onChange={(e) => set("websiteUrl", e.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
