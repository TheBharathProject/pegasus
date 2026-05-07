"use client";

import { useEffect, useState } from "react";
import { ProductFrame } from "@/components/frames";
import {
  BriefcaseIcon,
  CodeIcon,
  GraduationIcon,
  PencilIcon,
  PlusIcon,
  UserIcon
} from "@/components/icons";
import { api, type ApiProfile } from "@/lib/api-client";
import { isAuthed } from "@/lib/auth";

const EMPTY: ApiProfile = {
  isPublic: false,
  experiences: [],
  educations: [],
  projects: [],
  skills: []
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ApiProfile>(EMPTY);
  const [newSkill, setNewSkill] = useState({ name: "", category: "" });

  const refresh = async () => {
    try {
      const p = await api.get<ApiProfile>("/job-tracker/profile");
      setProfile(p);
    } catch {
      /* ignore — keep prior state */
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && !isAuthed()) {
      window.location.href = "/login";
      return;
    }
    refresh();
  }, []);

  const editHeadline = async () => {
    const next = window.prompt("Headline", profile.headline ?? "");
    if (next === null) return;
    try {
      await api.put("/job-tracker/profile", {
        headline: next,
        about: profile.about ?? "",
        location: profile.location ?? ""
      });
      await refresh();
    } catch (e) {
      window.alert(`Save failed: ${(e as Error).message}`);
    }
  };

  const addExperience = async () => {
    const company = window.prompt("Company");
    if (!company) return;
    const title = window.prompt("Title") ?? "";
    const period = window.prompt("Period (e.g. 2024 - Present)") ?? "";
    try {
      await api.post("/job-tracker/profile/experiences", {
        company,
        title,
        period,
        summary: "",
        ordinal: profile.experiences.length
      });
      await refresh();
    } catch (e) {
      window.alert(`Save failed: ${(e as Error).message}`);
    }
  };

  const addEducation = async () => {
    const school = window.prompt("School");
    if (!school) return;
    const degree = window.prompt("Degree") ?? "";
    const period = window.prompt("Period") ?? "";
    try {
      await api.post("/job-tracker/profile/educations", {
        school,
        degree,
        period,
        ordinal: profile.educations.length
      });
      await refresh();
    } catch (e) {
      window.alert(`Save failed: ${(e as Error).message}`);
    }
  };

  const addProject = async () => {
    const name = window.prompt("Project name");
    if (!name) return;
    const summary = window.prompt("Summary") ?? "";
    try {
      await api.post("/job-tracker/profile/projects", {
        name,
        summary,
        ordinal: profile.projects.length
      });
      await refresh();
    } catch (e) {
      window.alert(`Save failed: ${(e as Error).message}`);
    }
  };

  const addSkill = async () => {
    if (!newSkill.name.trim()) return;
    try {
      await api.post("/job-tracker/profile/skills", {
        name: newSkill.name.trim(),
        category: newSkill.category.trim()
      });
      setNewSkill({ name: "", category: "" });
      await refresh();
    } catch (e) {
      window.alert(`Save failed: ${(e as Error).message}`);
    }
  };

  const removeSkill = async (id: string) => {
    try {
      await api.delete(`/job-tracker/profile/skills/${id}`);
      await refresh();
    } catch (e) {
      window.alert(`Delete failed: ${(e as Error).message}`);
    }
  };

  return (
    <ProductFrame
      active="profile"
      title="Profile"
      intro="Tell the AI about you, once. So it can write about you everywhere."
    >
      <section className="settings-stack">
        <article className="settings-section">
          <div className="list-head">
            <span className="section-icon">
              <UserIcon /> About
            </span>
            <button className="ghost-button" type="button" onClick={editHeadline}>
              <PencilIcon width={12} height={12} /> Edit
            </button>
          </div>
          {profile.headline ? (
            <p style={{ marginTop: 16, color: "#ececea", fontSize: 15, lineHeight: 1.6 }}>
              {profile.headline}
            </p>
          ) : (
            <div className="profile-empty">No headline yet.</div>
          )}
        </article>

        <article className="settings-section">
          <div className="list-head">
            <span className="section-icon">
              <BriefcaseIcon /> Experience
            </span>
            <button className="ghost-button" type="button" onClick={addExperience}>
              <PlusIcon width={12} height={12} /> Add
            </button>
          </div>
          {profile.experiences.length === 0 ? (
            <div className="profile-empty">No experience yet. Add a role to help the AI know your work.</div>
          ) : (
            <div className="stack" style={{ marginTop: 16 }}>
              {profile.experiences.map((exp) => (
                <div key={exp.id} style={{ padding: "14px 0", borderTop: "1px solid #2e2e2e" }}>
                  <strong style={{ color: "#ececea", fontFamily: "var(--font-serif-stack)", fontSize: 16 }}>
                    {exp.title} · {exp.company}
                  </strong>
                  <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                    {exp.period}
                  </p>
                  {exp.summary ? (
                    <p style={{ marginTop: 8, color: "#b3b1ab", fontSize: 14, lineHeight: 1.6 }}>{exp.summary}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="settings-section">
          <div className="list-head">
            <span className="section-icon">
              <GraduationIcon /> Education
            </span>
            <button className="ghost-button" type="button" onClick={addEducation}>
              <PlusIcon width={12} height={12} /> Add
            </button>
          </div>
          {profile.educations.length === 0 ? (
            <div className="profile-empty">No education yet.</div>
          ) : (
            <div className="stack" style={{ marginTop: 16 }}>
              {profile.educations.map((ed) => (
                <div key={ed.id} style={{ padding: "14px 0", borderTop: "1px solid #2e2e2e" }}>
                  <strong style={{ color: "#ececea", fontFamily: "var(--font-serif-stack)", fontSize: 16 }}>
                    {ed.school}
                  </strong>
                  <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                    {ed.degree} · {ed.period}
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="settings-section">
          <div className="list-head">
            <span className="section-icon">
              <CodeIcon /> Projects
            </span>
            <button className="ghost-button" type="button" onClick={addProject}>
              <PlusIcon width={12} height={12} /> Add
            </button>
          </div>
          {profile.projects.length === 0 ? (
            <div className="profile-empty">No projects yet.</div>
          ) : (
            <div className="stack" style={{ marginTop: 16 }}>
              {profile.projects.map((pr) => (
                <div key={pr.id} style={{ padding: "14px 0", borderTop: "1px solid #2e2e2e" }}>
                  <strong style={{ color: "#ececea", fontFamily: "var(--font-serif-stack)", fontSize: 16 }}>
                    {pr.name}
                  </strong>
                  {pr.summary ? (
                    <p style={{ marginTop: 6, color: "#b3b1ab", fontSize: 14, lineHeight: 1.6 }}>{pr.summary}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="settings-section">
          <h2>Skills</h2>
          <div className="form-grid">
            <div className="field">
              <label>Skill</label>
              <input
                placeholder="e.g. React, Java, System Design"
                value={newSkill.name}
                onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Category</label>
              <input
                placeholder="Category (optional)"
                value={newSkill.category}
                onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })}
              />
            </div>
          </div>
          <button
            className="ghost-button"
            style={{ marginTop: 14 }}
            type="button"
            onClick={addSkill}
            disabled={!newSkill.name.trim()}
          >
            <PlusIcon width={12} height={12} /> Add
          </button>
          {profile.skills.length === 0 ? (
            <div className="profile-empty">No skills yet.</div>
          ) : (
            <div className="pill-row" style={{ marginTop: 18 }}>
              {profile.skills.map((s) => (
                <span
                  key={s.id}
                  className="pill"
                  onClick={() => removeSkill(s.id)}
                  style={{ cursor: "pointer" }}
                  title="Click to remove"
                >
                  {s.name}
                  {s.category ? <span style={{ marginLeft: 6, color: "#7d7c76" }}> · {s.category}</span> : null}
                </span>
              ))}
            </div>
          )}
        </article>
      </section>
    </ProductFrame>
  );
}
