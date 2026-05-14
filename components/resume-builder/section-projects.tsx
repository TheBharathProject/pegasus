"use client";

import { ItemHead } from "@/components/resume-builder/section-experiences";
import { PlusIcon } from "@/components/icons";
import type { ApiDraftProject } from "@/lib/api-client";

const EMPTY: ApiDraftProject = { name: "", description: "", techStack: "", link: "" };

export function SectionProjects({
  value,
  onChange
}: {
  value: ApiDraftProject[];
  onChange: (next: ApiDraftProject[]) => void;
}) {
  const update = (i: number, patch: Partial<ApiDraftProject>) =>
    onChange(value.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const n = [...value];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  const add = () => onChange([...value, { ...EMPTY }]);

  return (
    <section className="rb-section" id="rb-jump-projects">
      <header className="rb-section-head">
        <span className="rb-section-eyebrow" aria-hidden>07</span>
        <h3>Projects</h3>
        <button className="ghost-button rb-section-head-action" type="button" onClick={add}>
          <PlusIcon width={11} height={11} /> Add
        </button>
      </header>

      {value.length === 0 ? (
        <div className="rb-empty-cta-stack">
          <p className="muted small">
            Side projects, open-source work, hackathon builds — anything that
            rounds out the picture.
          </p>
          <button type="button" className="rb-empty-cta" onClick={add}>
            <PlusIcon width={14} height={14} />
            <span>Add your first project</span>
          </button>
        </div>
      ) : (
        <div className="rb-array">
          {value.map((proj, i) => (
            <article key={i} className="rb-array-item">
              <ItemHead
                title={proj.name || `Project ${i + 1}`}
                index={i}
                total={value.length}
                onUp={() => move(i, -1)}
                onDown={() => move(i, 1)}
                onRemove={() => remove(i)}
              />
              <div className="form-grid">
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Name</label>
                  <input
                    type="text"
                    value={proj.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Description</label>
                  <textarea
                    className="feedback-box"
                    rows={2}
                    value={proj.description ?? ""}
                    onChange={(e) => update(i, { description: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Tech stack</label>
                  <input
                    type="text"
                    placeholder="Go, Postgres, React"
                    value={proj.techStack ?? ""}
                    onChange={(e) => update(i, { techStack: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Link</label>
                  <input
                    type="url"
                    placeholder="https://…"
                    value={proj.link ?? ""}
                    onChange={(e) => update(i, { link: e.target.value })}
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
