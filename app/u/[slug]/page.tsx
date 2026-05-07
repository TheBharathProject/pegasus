"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MarketingFrame } from "@/components/frames";
import { api, ApiError, type ApiPublicProfile } from "@/lib/api-client";

export default function PublicProfilePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const [profile, setProfile] = useState<ApiPublicProfile | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api
      .get<ApiPublicProfile>(`/job-tracker/public/profile/${encodeURIComponent(slug)}`, { skipAuth: true })
      .then((p) => {
        setProfile(p);
        setStatus("ok");
      })
      .catch((e: Error) => {
        if (e instanceof ApiError && e.status === 404) {
          setStatus("missing");
        } else {
          setStatus("error");
          setError(e.message);
        }
      });
  }, [slug]);

  if (status === "loading") {
    return (
      <MarketingFrame>
        <main className="section shell">
          <p className="muted">Loading profile…</p>
        </main>
      </MarketingFrame>
    );
  }

  if (status === "missing" || !profile) {
    return (
      <MarketingFrame>
        <main className="section shell">
          <h1>Not found</h1>
          <p className="muted">
            That profile is private or doesn&apos;t exist. {error ? `(${error})` : null}
          </p>
        </main>
      </MarketingFrame>
    );
  }

  return (
    <MarketingFrame>
      <main className="section shell">
        <section className="profile-card">
          <div className="profile-hero">
            <div>
              <p className="eyebrow">Built on Sypher</p>
              <h1 className="profile-name">{profile.name}</h1>
              <p className="hero-copy" style={{ marginLeft: 0 }}>
                {[profile.headline, profile.location].filter(Boolean).join(" · ")}
              </p>
              {profile.about ? (
                <p className="section-copy" style={{ marginLeft: 0 }}>
                  {profile.about}
                </p>
              ) : null}
            </div>
            <div className="skill-row">
              {profile.skills.map((skill) => (
                <span className="skill-chip" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="panel-grid columns-2">
          <section className="panel">
            <h2>Experience</h2>
            <div className="stack">
              {profile.experiences.map((experience) => (
                <div className="experience-row" key={experience.id}>
                  <div>
                    <strong>
                      {experience.company} · {experience.title}
                    </strong>
                    {experience.summary ? <div className="data-title">{experience.summary}</div> : null}
                  </div>
                  {experience.period ? <span className="pill">{experience.period}</span> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Education</h2>
            <div className="stack">
              {profile.educations.map((education) => (
                <div className="experience-row" key={education.id}>
                  <div>
                    <strong>{education.school}</strong>
                    {education.degree ? <div className="data-title">{education.degree}</div> : null}
                  </div>
                  {education.period ? <span className="pill">{education.period}</span> : null}
                </div>
              ))}
            </div>
          </section>
        </div>

        {profile.projects.length > 0 ? (
          <section className="panel" style={{ marginTop: 18 }}>
            <div className="list-head">
              <div>
                <h2>Projects</h2>
              </div>
              <Link className="ghost-button" href="/">
                Built on Sypher
              </Link>
            </div>
            <div className="card-grid columns-2">
              {profile.projects.map((project) => (
                <article className="feature-card" key={project.id}>
                  <h3>{project.name}</h3>
                  <p>{project.summary}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </MarketingFrame>
  );
}
