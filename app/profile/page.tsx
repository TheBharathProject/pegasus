"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ProductFrame } from "@/components/frames";
import {
  BriefcaseIcon,
  CodeIcon,
  CloseIcon,
  GraduationIcon,
  GlobeIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UserIcon
} from "@/components/icons";
import {
  api,
  type ApiEducation,
  type ApiExperience,
  type ApiProfile,
  type ApiProject
} from "@/lib/api-client";
import { isAuthed, useAuth } from "@/lib/auth";
import { goTo } from "@/lib/paths";
import { formatPeriod } from "@/lib/period";

const EMPTY: ApiProfile = {
  isPublic: false,
  experiences: [],
  educations: [],
  projects: [],
  skills: []
};

// ---- Drafts ---------------------------------------------------------------

type AboutDraft = {
  headline: string;
  about: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  websiteUrl: string;
};
type ExperienceDraft = {
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
};
type EducationDraft = {
  school: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  gpa: string;
  description: string;
};
type ProjectDraft = {
  name: string;
  description: string;
  techStack: string;
  link: string;
};

const emptyExperience: ExperienceDraft = {
  company: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  description: ""
};
const emptyEducation: EducationDraft = {
  school: "",
  degree: "",
  field: "",
  startDate: "",
  endDate: "",
  gpa: "",
  description: ""
};
const emptyProject: ProjectDraft = { name: "", description: "", techStack: "", link: "" };

// ---- Page -----------------------------------------------------------------

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ApiProfile>(EMPTY);
  const [newSkill, setNewSkill] = useState({ name: "", category: "" });

  const [aboutOpen, setAboutOpen] = useState(false);
  const [aboutDraft, setAboutDraft] = useState<AboutDraft>({
    headline: "",
    about: "",
    location: "",
    linkedinUrl: "",
    githubUrl: "",
    websiteUrl: ""
  });

  const [expOpen, setExpOpen] = useState(false);
  const [expEditingId, setExpEditingId] = useState<string | null>(null);
  const [expDraft, setExpDraft] = useState<ExperienceDraft>(emptyExperience);

  const [edOpen, setEdOpen] = useState(false);
  const [edEditingId, setEdEditingId] = useState<string | null>(null);
  const [edDraft, setEdDraft] = useState<EducationDraft>(emptyEducation);

  const [prOpen, setPrOpen] = useState(false);
  const [prEditingId, setPrEditingId] = useState<string | null>(null);
  const [prDraft, setPrDraft] = useState<ProjectDraft>(emptyProject);

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
      goTo("/login");
      return;
    }
    refresh();
  }, []);

  // ---- About ---------------------------------------------------------------
  const openAbout = () => {
    setAboutDraft({
      headline: profile.headline ?? "",
      about: profile.about ?? "",
      location: profile.location ?? "",
      linkedinUrl: profile.linkedinUrl ?? "",
      githubUrl: profile.githubUrl ?? "",
      websiteUrl: profile.websiteUrl ?? ""
    });
    setAboutOpen(true);
  };

  const saveAbout = async () => {
    try {
      await api.put("/job-tracker/profile", aboutDraft);
      setAboutOpen(false);
      await refresh();
    } catch (e) {
      window.alert(`Save failed: ${(e as Error).message}`);
    }
  };

  // ---- Experience ----------------------------------------------------------
  const openNewExp = () => {
    setExpEditingId(null);
    setExpDraft(emptyExperience);
    setExpOpen(true);
  };
  const openEditExp = (exp: ApiExperience) => {
    setExpEditingId(exp.id);
    setExpDraft({
      company: exp.company,
      title: exp.title,
      location: exp.location ?? "",
      startDate: monthInput(exp.startDate),
      endDate: monthInput(exp.endDate),
      current: exp.current,
      description: exp.description ?? ""
    });
    setExpOpen(true);
  };
  const saveExp = async () => {
    if (!expDraft.company.trim() || !expDraft.title.trim()) return;
    const payload = {
      company: expDraft.company.trim(),
      title: expDraft.title.trim(),
      location: expDraft.location.trim(),
      startDate: monthToIso(expDraft.startDate),
      endDate: expDraft.current ? "" : monthToIso(expDraft.endDate),
      current: expDraft.current,
      description: expDraft.description.trim(),
      sortOrder: profile.experiences.length
    };
    try {
      if (expEditingId) {
        await api.put(`/job-tracker/profile/experiences/${expEditingId}`, payload);
      } else {
        await api.post("/job-tracker/profile/experiences", payload);
      }
      setExpOpen(false);
      await refresh();
    } catch (e) {
      window.alert(`Save failed: ${(e as Error).message}`);
    }
  };
  const deleteExp = async (id: string) => {
    if (!window.confirm("Remove this role?")) return;
    try {
      await api.delete(`/job-tracker/profile/experiences/${id}`);
      await refresh();
    } catch (e) {
      window.alert(`Delete failed: ${(e as Error).message}`);
    }
  };

  // ---- Education -----------------------------------------------------------
  const openNewEd = () => {
    setEdEditingId(null);
    setEdDraft(emptyEducation);
    setEdOpen(true);
  };
  const openEditEd = (ed: ApiEducation) => {
    setEdEditingId(ed.id);
    setEdDraft({
      school: ed.school,
      degree: ed.degree ?? "",
      field: ed.field ?? "",
      startDate: monthInput(ed.startDate),
      endDate: monthInput(ed.endDate),
      gpa: ed.gpa ?? "",
      description: ed.description ?? ""
    });
    setEdOpen(true);
  };
  const saveEd = async () => {
    if (!edDraft.school.trim()) return;
    const payload = {
      school: edDraft.school.trim(),
      degree: edDraft.degree.trim(),
      field: edDraft.field.trim(),
      startDate: monthToIso(edDraft.startDate),
      endDate: monthToIso(edDraft.endDate),
      gpa: edDraft.gpa.trim(),
      description: edDraft.description.trim(),
      sortOrder: profile.educations.length
    };
    try {
      if (edEditingId) {
        await api.put(`/job-tracker/profile/educations/${edEditingId}`, payload);
      } else {
        await api.post("/job-tracker/profile/educations", payload);
      }
      setEdOpen(false);
      await refresh();
    } catch (e) {
      window.alert(`Save failed: ${(e as Error).message}`);
    }
  };
  const deleteEd = async (id: string) => {
    if (!window.confirm("Remove this education?")) return;
    try {
      await api.delete(`/job-tracker/profile/educations/${id}`);
      await refresh();
    } catch (e) {
      window.alert(`Delete failed: ${(e as Error).message}`);
    }
  };

  // ---- Project -------------------------------------------------------------
  const openNewPr = () => {
    setPrEditingId(null);
    setPrDraft(emptyProject);
    setPrOpen(true);
  };
  const openEditPr = (pr: ApiProject) => {
    setPrEditingId(pr.id);
    setPrDraft({
      name: pr.name,
      description: pr.description ?? "",
      techStack: pr.techStack ?? "",
      link: pr.link ?? ""
    });
    setPrOpen(true);
  };
  const savePr = async () => {
    if (!prDraft.name.trim()) return;
    const payload = {
      name: prDraft.name.trim(),
      description: prDraft.description.trim(),
      techStack: prDraft.techStack.trim(),
      link: prDraft.link.trim(),
      sortOrder: profile.projects.length
    };
    try {
      if (prEditingId) {
        await api.put(`/job-tracker/profile/projects/${prEditingId}`, payload);
      } else {
        await api.post("/job-tracker/profile/projects", payload);
      }
      setPrOpen(false);
      await refresh();
    } catch (e) {
      window.alert(`Save failed: ${(e as Error).message}`);
    }
  };
  const deletePr = async (id: string) => {
    if (!window.confirm("Remove this project?")) return;
    try {
      await api.delete(`/job-tracker/profile/projects/${id}`);
      await refresh();
    } catch (e) {
      window.alert(`Delete failed: ${(e as Error).message}`);
    }
  };

  // ---- Skill ---------------------------------------------------------------
  const addSkill = async () => {
    if (!newSkill.name.trim()) return;
    try {
      await api.post("/job-tracker/profile/skills", {
        name: newSkill.name.trim(),
        category: newSkill.category.trim(),
        sortOrder: profile.skills.length
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

  // ---- Render --------------------------------------------------------------
  const initial = (user?.name ?? user?.email ?? "?").charAt(0).toUpperCase();
  const hasSocial =
    !!profile.linkedinUrl || !!profile.githubUrl || !!profile.websiteUrl;

  return (
    <ProductFrame
      active="profile"
      title="Profile"
      intro="Tell the AI about you, once. So it can write about you everywhere."
    >
      <section className="settings-stack">
        {/* About */}
        <article className="settings-section profile-about">
          <div className="profile-about-head">
            <div className="profile-about-identity">
              <div className="profile-avatar">
                {user?.pictureUrl ? (
                  <Image
                    src={user.pictureUrl}
                    alt={user.name ?? "Profile"}
                    width={72}
                    height={72}
                    unoptimized
                  />
                ) : (
                  <span aria-hidden>{initial}</span>
                )}
              </div>
              <div className="profile-about-meta">
                <h2 className="profile-name">{user?.name ?? "Your profile"}</h2>
                {profile.headline ? (
                  <p className="profile-headline">{profile.headline}</p>
                ) : (
                  <p className="profile-headline profile-headline--muted">
                    Add a one-line headline so the AI knows what to say first.
                  </p>
                )}
                <p className="profile-meta-line">
                  {profile.location ? (
                    <span>{profile.location}</span>
                  ) : (
                    <span className="profile-meta-faint">No location yet</span>
                  )}
                  {user?.email ? (
                    <>
                      <span className="profile-meta-dot">·</span>
                      <span className="profile-meta-faint">{user.email}</span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <button className="ghost-button" type="button" onClick={openAbout}>
              <PencilIcon width={12} height={12} /> Edit
            </button>
          </div>

          {profile.about ? (
            <p className="profile-about-body">{profile.about}</p>
          ) : (
            <p className="profile-about-body profile-about-body--empty">
              Write a short bio. The AI uses it to ground every cover letter and resume rewrite.
            </p>
          )}

          {hasSocial ? (
            <div className="profile-social-row">
              {profile.linkedinUrl ? (
                <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="profile-social">
                  <GlobeIcon width={14} height={14} /> LinkedIn
                </a>
              ) : null}
              {profile.githubUrl ? (
                <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="profile-social">
                  <CodeIcon width={14} height={14} /> GitHub
                </a>
              ) : null}
              {profile.websiteUrl ? (
                <a href={profile.websiteUrl} target="_blank" rel="noreferrer" className="profile-social">
                  <GlobeIcon width={14} height={14} /> Website
                </a>
              ) : null}
            </div>
          ) : null}
        </article>

        {/* Experience */}
        <article className="settings-section">
          <div className="list-head">
            <span className="section-icon">
              <BriefcaseIcon /> Experience
            </span>
            <button className="ghost-button" type="button" onClick={openNewExp}>
              <PlusIcon width={12} height={12} /> Add
            </button>
          </div>
          {profile.experiences.length === 0 ? (
            <div className="profile-empty">No experience yet. Add a role to help the AI know your work.</div>
          ) : (
            <div className="profile-list">
              {profile.experiences.map((exp) => (
                <div key={exp.id} className="profile-row">
                  <div className="profile-row-body">
                    <strong>
                      {exp.title} · {exp.company}
                    </strong>
                    <p className="profile-row-meta">
                      {[formatPeriod(exp), exp.location].filter(Boolean).join(" · ")}
                    </p>
                    {exp.description ? <p className="profile-row-desc">{exp.description}</p> : null}
                  </div>
                  <div className="profile-row-actions">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Edit"
                      onClick={() => openEditExp(exp)}
                    >
                      <PencilIcon width={12} height={12} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Delete"
                      onClick={() => deleteExp(exp.id)}
                    >
                      <TrashIcon width={12} height={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        {/* Education */}
        <article className="settings-section">
          <div className="list-head">
            <span className="section-icon">
              <GraduationIcon /> Education
            </span>
            <button className="ghost-button" type="button" onClick={openNewEd}>
              <PlusIcon width={12} height={12} /> Add
            </button>
          </div>
          {profile.educations.length === 0 ? (
            <div className="profile-empty">No education yet.</div>
          ) : (
            <div className="profile-list">
              {profile.educations.map((ed) => (
                <div key={ed.id} className="profile-row">
                  <div className="profile-row-body">
                    <strong>{ed.school}</strong>
                    <p className="profile-row-meta">
                      {[ed.degree, ed.field, formatPeriod(ed)].filter(Boolean).join(" · ")}
                      {ed.gpa ? ` · GPA ${ed.gpa}` : ""}
                    </p>
                    {ed.description ? <p className="profile-row-desc">{ed.description}</p> : null}
                  </div>
                  <div className="profile-row-actions">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Edit"
                      onClick={() => openEditEd(ed)}
                    >
                      <PencilIcon width={12} height={12} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Delete"
                      onClick={() => deleteEd(ed.id)}
                    >
                      <TrashIcon width={12} height={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        {/* Projects */}
        <article className="settings-section">
          <div className="list-head">
            <span className="section-icon">
              <CodeIcon /> Projects
            </span>
            <button className="ghost-button" type="button" onClick={openNewPr}>
              <PlusIcon width={12} height={12} /> Add
            </button>
          </div>
          {profile.projects.length === 0 ? (
            <div className="profile-empty">No projects yet.</div>
          ) : (
            <div className="profile-list">
              {profile.projects.map((pr) => (
                <div key={pr.id} className="profile-row">
                  <div className="profile-row-body">
                    <strong>{pr.name}</strong>
                    {pr.techStack ? <p className="profile-row-meta">{pr.techStack}</p> : null}
                    {pr.description ? <p className="profile-row-desc">{pr.description}</p> : null}
                    {pr.link ? (
                      <a
                        href={pr.link}
                        target="_blank"
                        rel="noreferrer"
                        className="profile-row-link"
                      >
                        {pr.link}
                      </a>
                    ) : null}
                  </div>
                  <div className="profile-row-actions">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Edit"
                      onClick={() => openEditPr(pr)}
                    >
                      <PencilIcon width={12} height={12} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Delete"
                      onClick={() => deletePr(pr.id)}
                    >
                      <TrashIcon width={12} height={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        {/* Skills */}
        <article className="settings-section">
          <div className="list-head">
            <span className="section-icon">
              <UserIcon /> Skills
            </span>
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Skill</label>
              <input
                placeholder="e.g. React, Java, System Design"
                value={newSkill.name}
                onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addSkill();
                }}
              />
            </div>
            <div className="field">
              <label>Category</label>
              <input
                placeholder="Category (optional)"
                value={newSkill.category}
                onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addSkill();
                }}
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
                  {s.category ? <span style={{ marginLeft: 6, color: "var(--text-faint)" }}> · {s.category}</span> : null}
                </span>
              ))}
            </div>
          )}
        </article>
      </section>

      {/* About modal */}
      {aboutOpen ? (
        <ModalShell title="Edit profile" onClose={() => setAboutOpen(false)}>
          <div className="form-grid">
            <div className="field wide">
              <label>Headline</label>
              <input
                placeholder="Senior backend engineer · payments · APIs that don't lie"
                value={aboutDraft.headline}
                onChange={(e) => setAboutDraft({ ...aboutDraft, headline: e.target.value })}
              />
            </div>
            <div className="field wide">
              <label>About</label>
              <textarea
                placeholder="A short bio — where you've worked, what you care about, what you'd want a recruiter to know about you in 60 seconds."
                value={aboutDraft.about}
                onChange={(e) => setAboutDraft({ ...aboutDraft, about: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Location</label>
              <input
                placeholder="Bengaluru, India"
                value={aboutDraft.location}
                onChange={(e) => setAboutDraft({ ...aboutDraft, location: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Website</label>
              <input
                type="url"
                placeholder="https://yourname.dev"
                value={aboutDraft.websiteUrl}
                onChange={(e) => setAboutDraft({ ...aboutDraft, websiteUrl: e.target.value })}
              />
            </div>
            <div className="field">
              <label>LinkedIn</label>
              <input
                type="url"
                placeholder="https://linkedin.com/in/yourname"
                value={aboutDraft.linkedinUrl}
                onChange={(e) => setAboutDraft({ ...aboutDraft, linkedinUrl: e.target.value })}
              />
            </div>
            <div className="field">
              <label>GitHub</label>
              <input
                type="url"
                placeholder="https://github.com/yourname"
                value={aboutDraft.githubUrl}
                onChange={(e) => setAboutDraft({ ...aboutDraft, githubUrl: e.target.value })}
              />
            </div>
          </div>
          <ModalActions
            onCancel={() => setAboutOpen(false)}
            onSubmit={saveAbout}
            disabled={false}
            submitLabel="Save"
          />
        </ModalShell>
      ) : null}

      {/* Experience modal */}
      {expOpen ? (
        <ModalShell
          title={expEditingId ? "Edit experience" : "Add experience"}
          onClose={() => setExpOpen(false)}
        >
          <div className="form-grid">
            <div className="field">
              <label>Company *</label>
              <input
                placeholder="Stripe"
                value={expDraft.company}
                onChange={(e) => setExpDraft({ ...expDraft, company: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Title *</label>
              <input
                placeholder="Senior Engineer"
                value={expDraft.title}
                onChange={(e) => setExpDraft({ ...expDraft, title: e.target.value })}
              />
            </div>
            <div className="field wide">
              <label>Location</label>
              <input
                placeholder="Bengaluru · Remote"
                value={expDraft.location}
                onChange={(e) => setExpDraft({ ...expDraft, location: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Start date</label>
              <input
                type="month"
                value={expDraft.startDate}
                onChange={(e) => setExpDraft({ ...expDraft, startDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>End date</label>
              <input
                type="month"
                value={expDraft.endDate}
                onChange={(e) => setExpDraft({ ...expDraft, endDate: e.target.value })}
                disabled={expDraft.current}
              />
            </div>
            <div className="field wide">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={expDraft.current}
                  onChange={(e) => setExpDraft({ ...expDraft, current: e.target.checked })}
                />
                <span>I currently work here</span>
              </label>
            </div>
            <div className="field wide">
              <label>What you did</label>
              <textarea
                placeholder="Bullet points work well. Talk about scope, scale, and outcomes."
                value={expDraft.description}
                onChange={(e) => setExpDraft({ ...expDraft, description: e.target.value })}
              />
            </div>
          </div>
          <ModalActions
            onCancel={() => setExpOpen(false)}
            onSubmit={saveExp}
            disabled={!expDraft.company.trim() || !expDraft.title.trim()}
            submitLabel={expEditingId ? "Save changes" : "Add experience"}
          />
        </ModalShell>
      ) : null}

      {/* Education modal */}
      {edOpen ? (
        <ModalShell
          title={edEditingId ? "Edit education" : "Add education"}
          onClose={() => setEdOpen(false)}
        >
          <div className="form-grid">
            <div className="field wide">
              <label>School *</label>
              <input
                placeholder="IIT Delhi"
                value={edDraft.school}
                onChange={(e) => setEdDraft({ ...edDraft, school: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Degree</label>
              <input
                placeholder="B.Tech"
                value={edDraft.degree}
                onChange={(e) => setEdDraft({ ...edDraft, degree: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Field</label>
              <input
                placeholder="Computer Science"
                value={edDraft.field}
                onChange={(e) => setEdDraft({ ...edDraft, field: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Start date</label>
              <input
                type="month"
                value={edDraft.startDate}
                onChange={(e) => setEdDraft({ ...edDraft, startDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>End date</label>
              <input
                type="month"
                value={edDraft.endDate}
                onChange={(e) => setEdDraft({ ...edDraft, endDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>GPA (optional)</label>
              <input
                placeholder="9.1 / 10"
                value={edDraft.gpa}
                onChange={(e) => setEdDraft({ ...edDraft, gpa: e.target.value })}
              />
            </div>
            <div className="field wide">
              <label>Notes</label>
              <textarea
                placeholder="Coursework, leadership, accolades — whatever the AI should know."
                value={edDraft.description}
                onChange={(e) => setEdDraft({ ...edDraft, description: e.target.value })}
              />
            </div>
          </div>
          <ModalActions
            onCancel={() => setEdOpen(false)}
            onSubmit={saveEd}
            disabled={!edDraft.school.trim()}
            submitLabel={edEditingId ? "Save changes" : "Add education"}
          />
        </ModalShell>
      ) : null}

      {/* Project modal */}
      {prOpen ? (
        <ModalShell
          title={prEditingId ? "Edit project" : "Add project"}
          onClose={() => setPrOpen(false)}
        >
          <div className="form-grid">
            <div className="field wide">
              <label>Name *</label>
              <input
                placeholder="Pegasus"
                value={prDraft.name}
                onChange={(e) => setPrDraft({ ...prDraft, name: e.target.value })}
              />
            </div>
            <div className="field wide">
              <label>Description</label>
              <textarea
                placeholder="What it is, who it's for, what shipped, what you learned."
                value={prDraft.description}
                onChange={(e) => setPrDraft({ ...prDraft, description: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Tech stack</label>
              <input
                placeholder="Next.js · Go · Postgres"
                value={prDraft.techStack}
                onChange={(e) => setPrDraft({ ...prDraft, techStack: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Link</label>
              <input
                type="url"
                placeholder="https://…"
                value={prDraft.link}
                onChange={(e) => setPrDraft({ ...prDraft, link: e.target.value })}
              />
            </div>
          </div>
          <ModalActions
            onCancel={() => setPrOpen(false)}
            onSubmit={savePr}
            disabled={!prDraft.name.trim()}
            submitLabel={prEditingId ? "Save changes" : "Add project"}
          />
        </ModalShell>
      ) : null}
    </ProductFrame>
  );
}

// ---- Helpers --------------------------------------------------------------

// Backend stores ISO YYYY-MM-DD; <input type="month"> wants YYYY-MM. Slice
// when reading, expand to YYYY-MM-01 when writing.
function monthInput(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 7);
}
function monthToIso(month: string): string {
  if (!month) return "";
  return `${month}-01`;
}

function ModalShell({
  title,
  children,
  onClose
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="list-head">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose} type="button">
            <CloseIcon width={14} height={14} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function ModalActions({
  onCancel,
  onSubmit,
  disabled,
  submitLabel
}: {
  onCancel: () => void;
  onSubmit: () => void;
  disabled: boolean;
  submitLabel: string;
}) {
  return (
    <div className="section-actions" style={{ justifyContent: "flex-end" }}>
      <button className="ghost-button" onClick={onCancel} type="button">
        Cancel
      </button>
      <button className="primary-button" onClick={onSubmit} disabled={disabled} type="button">
        {submitLabel}
      </button>
    </div>
  );
}
