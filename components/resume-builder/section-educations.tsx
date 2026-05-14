"use client";

import { ItemHead } from "@/components/resume-builder/section-experiences";
import { PlusIcon } from "@/components/icons";
import type { ApiDraftEducation } from "@/lib/api-client";

const EMPTY: ApiDraftEducation = {
  school: "",
  degree: "",
  field: "",
  startDate: "",
  endDate: "",
  gpa: "",
  description: ""
};

export function SectionEducations({
  value,
  onChange
}: {
  value: ApiDraftEducation[];
  onChange: (next: ApiDraftEducation[]) => void;
}) {
  const update = (i: number, patch: Partial<ApiDraftEducation>) =>
    onChange(value.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
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
    <section className="rb-section" id="rb-jump-educations">
      <header className="rb-section-head">
        <span className="rb-section-eyebrow" aria-hidden>05</span>
        <h3>Education</h3>
        <button className="ghost-button rb-section-head-action" type="button" onClick={add}>
          <PlusIcon width={11} height={11} /> Add
        </button>
      </header>

      {value.length === 0 ? (
        <button type="button" className="rb-empty-cta" onClick={add}>
          <PlusIcon width={14} height={14} />
          <span>Add your education</span>
        </button>
      ) : (
        <div className="rb-array">
          {value.map((ed, i) => (
            <article key={i} className="rb-array-item">
              <ItemHead
                title={ed.school || `Entry ${i + 1}`}
                index={i}
                total={value.length}
                onUp={() => move(i, -1)}
                onDown={() => move(i, 1)}
                onRemove={() => remove(i)}
              />
              <div className="form-grid">
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>School</label>
                  <input
                    type="text"
                    value={ed.school}
                    onChange={(e) => update(i, { school: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Degree</label>
                  <input
                    type="text"
                    placeholder="B.Tech"
                    value={ed.degree ?? ""}
                    onChange={(e) => update(i, { degree: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Field</label>
                  <input
                    type="text"
                    placeholder="Computer Science"
                    value={ed.field ?? ""}
                    onChange={(e) => update(i, { field: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Start date</label>
                  <input
                    type="text"
                    placeholder="2018"
                    value={ed.startDate ?? ""}
                    onChange={(e) => update(i, { startDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>End date</label>
                  <input
                    type="text"
                    placeholder="2022"
                    value={ed.endDate ?? ""}
                    onChange={(e) => update(i, { endDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>GPA</label>
                  <input
                    type="text"
                    placeholder="3.8 / 4.0"
                    value={ed.gpa ?? ""}
                    onChange={(e) => update(i, { gpa: e.target.value })}
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Notes</label>
                  <textarea
                    className="feedback-box"
                    rows={2}
                    placeholder="Honors, coursework, thesis, etc."
                    value={ed.description ?? ""}
                    onChange={(e) => update(i, { description: e.target.value })}
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
