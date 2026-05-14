"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ApiDraftContent } from "@/lib/api-client";

// Resume preview — HTML approximation of the LaTeX classic-v1 template.
//
// Renders as page-shaped cards stacked vertically. A hidden measurement
// clone of the full content gives us the total rendered height; we divide
// by PAGE_PX_HEIGHT (Letter aspect at our preview scale) and render that
// many visible page cards, each clipped to one page worth of content via
// translateY on a duplicated content tree. So if the resume overflows
// page 1, page 2 appears beneath with the continuation. Exact pagination
// is provided by Tectonic at export time; this is an editor-time visual
// aid that's "close enough" to make page-fit decisions.

// Visual page dimensions. Letter is 8.5×11 (ratio 1.294); we scale to fit
// the preview pane width. The chosen base height of 1056 corresponds to
// US Letter at 96dpi; the rendered card gets CSS-scaled to the pane width.
//
// PAGE_MARGIN_TOP/BOTTOM carve out a visible whitespace band at the top
// and bottom of every page card. Without them, page 2's content sat
// flush against the top edge because the slice translation just shows
// "whatever was at y = i * PAGE_BASE_HEIGHT" without per-page padding.
// The content slice now lives inside an inner clipping area whose height
// is PAGE_CONTENT_HEIGHT (936px), and pagination is computed against
// that height — so a 1900px content produces 3 pages, not 2 squished
// against a flush edge.
const PAGE_BASE_WIDTH = 816; // 8.5in × 96dpi
const PAGE_BASE_HEIGHT = 1056; // 11in × 96dpi
const PAGE_MARGIN_TOP = 60;
const PAGE_MARGIN_BOTTOM = 60;
const PAGE_CONTENT_HEIGHT = PAGE_BASE_HEIGHT - PAGE_MARGIN_TOP - PAGE_MARGIN_BOTTOM;

export function ResumeBuilderPreview({ content }: { content: ApiDraftContent }) {
  const measureRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);
  const [scale, setScale] = useState(1);

  // Re-measure whenever content changes, and re-scale whenever the pane
  // resizes (ResizeObserver covers both viewport and sidebar collapse).
  // Pagination divides by PAGE_CONTENT_HEIGHT (not full page height) so
  // each page's content slice fits inside its top/bottom margin band.
  useLayoutEffect(() => {
    const measure = () => {
      if (!measureRef.current || !wrapRef.current) return;
      const contentH = measureRef.current.scrollHeight;
      const paneW = wrapRef.current.clientWidth;
      const nextScale = Math.min(1, paneW / PAGE_BASE_WIDTH);
      const pages = Math.max(1, Math.ceil(contentH / PAGE_CONTENT_HEIGHT));
      setScale(nextScale);
      setPageCount(pages);
    };
    measure();
    let observer: ResizeObserver | null = null;
    if (wrapRef.current && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(wrapRef.current);
    }
    return () => observer?.disconnect();
  }, [content]);

  const scaledW = PAGE_BASE_WIDTH * scale;
  const scaledH = PAGE_BASE_HEIGHT * scale;

  return (
    <div ref={wrapRef} className="rb-preview-wrap">
      {/* Hidden measurement clone at full base width so the height we read
          maps directly to PAGE_BASE_HEIGHT units. Out of layout flow. */}
      <div className="rb-preview-measure" aria-hidden>
        <div ref={measureRef} style={{ width: PAGE_BASE_WIDTH }}>
          <PageInnerContent content={content} />
        </div>
      </div>

      <div className="rb-preview-pages">
        {Array.from({ length: pageCount }, (_, i) => (
          <div
            key={i}
            className="rb-page"
            style={{ width: scaledW, height: scaledH }}
          >
            <div
              className="rb-page-scale"
              style={{
                width: PAGE_BASE_WIDTH,
                height: PAGE_BASE_HEIGHT,
                transform: `scale(${scale})`
              }}
            >
              {/* Top margin band — visible whitespace at the top of every
                  page card. Acts as the "page top margin" so content
                  starts inside a safe zone instead of flush against the
                  card's top edge. */}
              <div
                aria-hidden
                style={{ height: PAGE_MARGIN_TOP, width: "100%" }}
              />
              {/* Content area — clips its child to PAGE_CONTENT_HEIGHT.
                  The child is a tall slice of the full content tree,
                  translated up by i × PAGE_CONTENT_HEIGHT so each page
                  uncovers its own band. */}
              <div
                className="rb-page-content-area"
                style={{ height: PAGE_CONTENT_HEIGHT, width: "100%" }}
              >
                <div
                  className="rb-page-slice"
                  style={{
                    transform: `translateY(-${i * PAGE_CONTENT_HEIGHT}px)`
                  }}
                >
                  <PageInnerContent content={content} />
                </div>
              </div>
              {/* Bottom margin band — paired with the top so the visible
                  page card looks like a printed sheet with breathing room. */}
              <div
                aria-hidden
                style={{ height: PAGE_MARGIN_BOTTOM, width: "100%" }}
              />
            </div>
            <div className="rb-page-number">
              Page {i + 1} of {pageCount}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// The actual paper content — same JSX used in both the measurement clone
// and the visible page cards. Single source of truth. Style options are
// applied via CSS custom properties on .rb-preview-paper so deeper
// elements (section h2 border, link colour) inherit without prop drill.
function PageInnerContent({ content }: { content: ApiDraftContent }) {
  const p = content.personal;
  const contactParts: string[] = [];
  if (p.email) contactParts.push(p.email);
  if (p.phone) contactParts.push(p.phone);
  if (p.location) contactParts.push(p.location);

  const style = content.style ?? {};
  const accent = style.accentColor ?? "#1a1a1a";
  const divider = style.sectionDivider ?? "solid";
  const fontFamily = style.fontFamily ?? "serif";
  const headerAlign = style.headerAlignment ?? "center";

  // Translate divider keyword into a CSS border style.
  const dividerCss =
    divider === "none" ? "none" : divider === "dashed" ? "dashed" : "solid";

  // Translate font keyword into the actual stack. "sans" picks a Helvetica-
  // adjacent system stack since Latin Modern Sans isn't web-available.
  const fontStack =
    fontFamily === "sans"
      ? `"Helvetica Neue", Helvetica, Arial, sans-serif`
      : `"Charter", "Iowan Old Style", "Georgia", serif`;

  // CSS custom props — consumed by .rb-preview-paper rules in globals.css.
  const paperStyle: React.CSSProperties = {
    ["--rb-accent" as string]: accent,
    ["--rb-divider-style" as string]: dividerCss,
    ["--rb-font-stack" as string]: fontStack,
    ["--rb-header-align" as string]: headerAlign === "left" ? "left" : "center"
  };

  return (
    <div className="rb-preview-paper" style={paperStyle}>
      <header className="rb-preview-head">
        <h1>{p.name || "Your Name"}</h1>
        {p.headline ? <p className="rb-preview-headline">{p.headline}</p> : null}
        {(contactParts.length > 0 ||
          p.linkedinUrl ||
          p.githubUrl ||
          p.websiteUrl) && (
          <p className="rb-preview-contact">
            {contactParts.map((part, idx) => (
              <span key={`c-${idx}`}>
                {idx > 0 ? <span className="rb-preview-dot"> · </span> : null}
                {part}
              </span>
            ))}
            {p.linkedinUrl ? (
              <span>
                {contactParts.length > 0 ? (
                  <span className="rb-preview-dot"> · </span>
                ) : null}
                <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer">
                  LinkedIn
                </a>
              </span>
            ) : null}
            {p.githubUrl ? (
              <span>
                <span className="rb-preview-dot"> · </span>
                <a href={p.githubUrl} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </span>
            ) : null}
            {p.websiteUrl ? (
              <span>
                <span className="rb-preview-dot"> · </span>
                <a href={p.websiteUrl} target="_blank" rel="noopener noreferrer">
                  Website
                </a>
              </span>
            ) : null}
          </p>
        )}
      </header>

      {content.summary ? (
        <Section title="Summary">
          <p>{content.summary}</p>
        </Section>
      ) : null}

      {content.experiences && content.experiences.length > 0 ? (
        <Section title="Experience">
          {content.experiences.map((exp, i) => (
            <div key={`exp-${i}`} className="rb-preview-entry">
              <div className="rb-preview-entry-head">
                <strong>{exp.title || "Title"}</strong>
                <span className="muted">
                  {dateRange(exp.startDate, exp.endDate, exp.current)}
                </span>
              </div>
              <div className="rb-preview-entry-sub">
                <em>{exp.company || "Company"}</em>
                {exp.location ? <span className="muted">{exp.location}</span> : null}
              </div>
              {(exp.description ?? []).filter((s) => s.trim()).length > 0 ? (
                <ul className="rb-preview-bullets">
                  {(exp.description ?? [])
                    .filter((s) => s.trim())
                    .map((b, j) => (
                      <li key={`b-${j}`}>{b}</li>
                    ))}
                </ul>
              ) : null}
            </div>
          ))}
        </Section>
      ) : null}

      {content.educations && content.educations.length > 0 ? (
        <Section title="Education">
          {content.educations.map((ed, i) => (
            <div key={`ed-${i}`} className="rb-preview-entry">
              <div className="rb-preview-entry-head">
                <strong>{ed.school || "School"}</strong>
                <span className="muted">
                  {dateRange(ed.startDate, ed.endDate, false)}
                </span>
              </div>
              <div className="rb-preview-entry-sub">
                <span>
                  {ed.degree}
                  {ed.degree && ed.field ? ", " : ""}
                  {ed.field}
                </span>
                {ed.gpa ? <span className="muted">GPA: {ed.gpa}</span> : null}
              </div>
              {ed.description ? <p>{ed.description}</p> : null}
            </div>
          ))}
        </Section>
      ) : null}

      {content.skills && content.skills.length > 0 ? (
        <Section title="Skills">
          <ul className="rb-preview-bullets">
            {content.skills.map((g, i) => (
              <li key={`sk-${i}`}>
                <strong>{g.category}:</strong> {g.items.join(", ")}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {content.projects && content.projects.length > 0 ? (
        <Section title="Projects">
          {content.projects.map((proj, i) => (
            <div key={`pr-${i}`} className="rb-preview-entry">
              <div className="rb-preview-entry-head">
                <strong>{proj.name || "Project"}</strong>
                {proj.techStack ? (
                  <em className="muted">({proj.techStack})</em>
                ) : null}
              </div>
              {proj.description ? <p>{proj.description}</p> : null}
              {proj.link ? (
                <a
                  href={proj.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rb-preview-link"
                >
                  {proj.link}
                </a>
              ) : null}
            </div>
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rb-preview-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function dateRange(start?: string, end?: string, current?: boolean): string {
  const s = (start ?? "").trim();
  const e = (end ?? "").trim();
  if (!s && !e && !current) return "";
  if (current) return s ? `${s} – Present` : "Present";
  if (!s) return e;
  if (!e) return s;
  return `${s} – ${e}`;
}
