"use client";

import { useEffect, useRef, useState } from "react";
import { ItemHead } from "@/components/resume-builder/section-experiences";
import { PlusIcon } from "@/components/icons";
import type { ApiDraftSkillGroup } from "@/lib/api-client";

const EMPTY: ApiDraftSkillGroup = { category: "", items: [] };

export function SectionSkills({
  value,
  onChange
}: {
  value: ApiDraftSkillGroup[];
  onChange: (next: ApiDraftSkillGroup[]) => void;
}) {
  const update = (i: number, patch: Partial<ApiDraftSkillGroup>) =>
    onChange(value.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const n = [...value];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  const add = () =>
    onChange([...value, { ...EMPTY, category: defaultCategory(value) }]);

  return (
    <section className="rb-section" id="rb-jump-skills">
      <header className="rb-section-head">
        <span className="rb-section-eyebrow" aria-hidden>06</span>
        <h3>Skills</h3>
        <button className="ghost-button rb-section-head-action" type="button" onClick={add}>
          <PlusIcon width={11} height={11} /> Add
        </button>
      </header>

      {value.length === 0 ? (
        <div className="rb-empty-cta-stack">
          <p className="muted small">
            Group your skills (Languages / Frameworks / Tools). Each group becomes
            a single bulleted line on the PDF.
          </p>
          <button type="button" className="rb-empty-cta" onClick={add}>
            <PlusIcon width={14} height={14} />
            <span>Add your first group</span>
          </button>
        </div>
      ) : (
        <div className="rb-array">
          {value.map((group, i) => (
            <article key={i} className="rb-array-item">
              <ItemHead
                title={group.category || `Group ${i + 1}`}
                index={i}
                total={value.length}
                onUp={() => move(i, -1)}
                onDown={() => move(i, 1)}
                onRemove={() => remove(i)}
              />
              <div className="form-grid">
                <div className="field">
                  <label>Category</label>
                  <input
                    type="text"
                    placeholder="Languages"
                    value={group.category}
                    onChange={(e) => update(i, { category: e.target.value })}
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Items <span className="muted small">(comma-separated)</span></label>
                  <SkillItemsField
                    items={group.items}
                    onChange={(items) => update(i, { items })}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

// SkillItemsField is a controlled comma-separated text input over a
// string[]. Tracks the raw text locally so the user can type commas,
// trailing spaces, and partial entries without the parent's array-
// round-trip wiping the input. The parsed array is pushed up on every
// keystroke; we re-sync from the parent only when the underlying
// items array changes from an EXTERNAL source (different draft loaded,
// LaTeX parser rewrote skills, etc.) — never from our own onChange.
function SkillItemsField({
  items,
  onChange
}: {
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [raw, setRaw] = useState(() => items.join(", "));
  // Stable key over array contents so the effect fires on content
  // changes, not on every parent re-render's new array reference.
  const itemsKey = items.join("\x00");
  const ownChangeRef = useRef(false);

  useEffect(() => {
    // Our own onChange already updated raw above; skip the re-sync so
    // we don't clobber the user's in-flight typing (e.g. trailing
    // comma + space).
    if (ownChangeRef.current) {
      ownChangeRef.current = false;
      return;
    }
    setRaw(items.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  return (
    <input
      type="text"
      placeholder="Go, TypeScript, Python"
      value={raw}
      onChange={(e) => {
        const next = e.target.value;
        setRaw(next);
        ownChangeRef.current = true;
        onChange(
          next
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        );
      }}
    />
  );
}

function defaultCategory(existing: ApiDraftSkillGroup[]): string {
  const seeds = ["Languages", "Frameworks", "Tools", "Cloud", "Other"];
  const used = new Set(existing.map((g) => g.category));
  return seeds.find((s) => !used.has(s)) ?? "";
}
