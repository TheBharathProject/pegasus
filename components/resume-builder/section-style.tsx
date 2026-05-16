"use client";

import { track } from "@/lib/analytics";
import { defaultStyle } from "@/lib/resume-builder-content";
import {
  FONT_OPTIONS,
  normalizeFontFamily
} from "@/lib/resume-builder/font-registry";
import type { ApiDraftStyle } from "@/lib/api-client";

// Style controls — accent colour + divider + font + header alignment.
// All fields are optional on the wire (missing = use default) but the
// editor exposes them as required-looking inputs so the user always knows
// what's active. Reset link snaps everything back to defaults.

export function SectionStyle({
  value,
  onChange
}: {
  value: ApiDraftStyle | undefined;
  onChange: (next: ApiDraftStyle) => void;
}) {
  const v = { ...defaultStyle(), ...(value ?? {}) };
  const set = <K extends keyof ApiDraftStyle>(key: K, x: ApiDraftStyle[K]) =>
    onChange({ ...v, [key]: x });

  return (
    <section className="rb-section" id="rb-jump-style">
      <header className="rb-section-head">
        <span className="rb-section-eyebrow" aria-hidden>01</span>
        <h3>Style</h3>
        <button
          type="button"
          className="ghost-button rb-section-head-action"
          onClick={() => onChange(defaultStyle())}
          title="Reset to defaults"
        >
          <svg
            viewBox="0 0 14 14"
            width="11"
            height="11"
            aria-hidden
            style={{ marginRight: 4 }}
          >
            <path
              d="M11 4.5a4.5 4.5 0 1 0 1 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M11 1.5v3.2h-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Reset
        </button>
      </header>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="rb-accent">Accent colour</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              id="rb-accent"
              type="color"
              value={v.accentColor}
              onChange={(e) => set("accentColor", e.target.value)}
              style={{
                width: 38,
                height: 32,
                padding: 2,
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "transparent",
                cursor: "pointer"
              }}
            />
            <input
              type="text"
              value={v.accentColor}
              onChange={(e) => set("accentColor", e.target.value)}
              placeholder="#1a1a1a"
              style={{ flex: 1 }}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="rb-divider">Section divider</label>
          <select
            id="rb-divider"
            className="filter-select"
            value={v.sectionDivider}
            onChange={(e) =>
              set(
                "sectionDivider",
                e.target.value as NonNullable<ApiDraftStyle["sectionDivider"]>
              )
            }
          >
            <option value="solid">Solid line</option>
            <option value="dashed">Dashed line</option>
            <option value="none">No divider</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="rb-font">Font family</label>
          <select
            id="rb-font"
            className="filter-select"
            // Coerce legacy "serif"/"sans" to the new IDs so the dropdown
            // shows the right item for old drafts.
            value={normalizeFontFamily(v.fontFamily)}
            onChange={(e) => {
              const id = e.target.value as NonNullable<ApiDraftStyle["fontFamily"]>;
              set("fontFamily", id);
              track({ name: "font_changed", params: { font_id: id } });
            }}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id} style={{ fontFamily: f.webStack }}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="rb-header">Header alignment</label>
          <select
            id="rb-header"
            className="filter-select"
            value={v.headerAlignment}
            onChange={(e) =>
              set(
                "headerAlignment",
                e.target.value as NonNullable<ApiDraftStyle["headerAlignment"]>
              )
            }
          >
            <option value="center">Centered</option>
            <option value="left">Left aligned</option>
          </select>
        </div>
      </div>
    </section>
  );
}
