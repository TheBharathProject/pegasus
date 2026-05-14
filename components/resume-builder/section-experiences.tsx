"use client";

import { PlusIcon, TrashIcon } from "@/components/icons";
import type { ApiDraftExperience } from "@/lib/api-client";

const EMPTY: ApiDraftExperience = {
  company: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  description: []
};

export function SectionExperiences({
  value,
  onChange
}: {
  value: ApiDraftExperience[];
  onChange: (next: ApiDraftExperience[]) => void;
}) {
  const update = (i: number, patch: Partial<ApiDraftExperience>) =>
    onChange(value.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const add = () => onChange([...value, { ...EMPTY }]);

  return (
    <section className="rb-section" id="rb-jump-experiences">
      <header className="rb-section-head">
        <span className="rb-section-eyebrow" aria-hidden>04</span>
        <h3>Experience</h3>
        <button className="ghost-button rb-section-head-action" type="button" onClick={add}>
          <PlusIcon width={11} height={11} /> Add
        </button>
      </header>

      {value.length === 0 ? (
        <button type="button" className="rb-empty-cta" onClick={add}>
          <PlusIcon width={14} height={14} />
          <span>Add your first role</span>
        </button>
      ) : (
        <div className="rb-array">
          {value.map((exp, i) => (
            <article key={i} className="rb-array-item">
              <ItemHead
                title={exp.title || exp.company || `Entry ${i + 1}`}
                index={i}
                total={value.length}
                onUp={() => move(i, -1)}
                onDown={() => move(i, 1)}
                onRemove={() => remove(i)}
              />
              <div className="form-grid">
                <div className="field">
                  <label>Company</label>
                  <input
                    type="text"
                    value={exp.company}
                    onChange={(e) => update(i, { company: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Title</label>
                  <input
                    type="text"
                    value={exp.title}
                    onChange={(e) => update(i, { title: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Location</label>
                  <input
                    type="text"
                    value={exp.location ?? ""}
                    onChange={(e) => update(i, { location: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>
                    <input
                      type="checkbox"
                      checked={exp.current}
                      onChange={(e) =>
                        update(i, {
                          current: e.target.checked,
                          ...(e.target.checked ? { endDate: "" } : {})
                        })
                      }
                      style={{ marginRight: 6 }}
                    />
                    Currently here
                  </label>
                </div>
                <div className="field">
                  <label>Start date</label>
                  <input
                    type="text"
                    placeholder="Jan 2024"
                    value={exp.startDate ?? ""}
                    onChange={(e) => update(i, { startDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>End date</label>
                  <input
                    type="text"
                    placeholder="Present"
                    disabled={exp.current}
                    value={exp.current ? "" : exp.endDate ?? ""}
                    onChange={(e) => update(i, { endDate: e.target.value })}
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Bullets <span className="muted small">(one per line)</span></label>
                  <textarea
                    className="feedback-box"
                    rows={4}
                    placeholder="Shipped X to Y impact…&#10;Owned Z for the foo team…"
                    value={(exp.description ?? []).join("\n")}
                    onChange={(e) =>
                      update(i, {
                        description: e.target.value
                          .split(/\r?\n/)
                          .map((s) => s) // preserve indent / spacing while typing
                      })
                    }
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

export function ItemHead({
  title,
  index,
  total,
  onUp,
  onDown,
  onRemove
}: {
  title: string;
  index: number;
  total: number;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  return (
    <header className="rb-array-item-head">
      <strong className="rb-array-item-title">{title}</strong>
      <div className="rb-array-item-actions">
        <button
          type="button"
          className="icon-button"
          title="Move up"
          aria-label="Move up"
          disabled={index === 0}
          onClick={onUp}
        >
          ↑
        </button>
        <button
          type="button"
          className="icon-button"
          title="Move down"
          aria-label="Move down"
          disabled={index === total - 1}
          onClick={onDown}
        >
          ↓
        </button>
        <button
          type="button"
          className="icon-button"
          title="Remove"
          aria-label="Remove"
          onClick={onRemove}
        >
          <TrashIcon width={12} height={12} />
        </button>
      </div>
    </header>
  );
}
