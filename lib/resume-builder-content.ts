// Resume Builder — DraftContent helpers shared across the page + editor.
// Single source of truth for "what an empty draft looks like" and "how to
// map a Profile into a draft." Keeping this here (not inside a component)
// lets the page's "Start blank" + "Start from Profile" paths import the
// same shape without prop-drilling.

import {
  api,
  type ApiDraftContent,
  type ApiDraftExperience,
  type ApiDraftEducation,
  type ApiDraftProject,
  type ApiDraftSkillGroup,
  type ApiProfile
} from "@/lib/api-client";
import { getMe } from "@/lib/auth";

// emptyDraftContent returns a blank, valid DraftContent. The personal
// name defaults to empty — the editor's Personal section is the obvious
// first field for a blank-start user to fill. defaultStyle() ships the
// v1 visual defaults so the preview is always coherent on load.
export function emptyDraftContent(): ApiDraftContent {
  return {
    personal: { name: "" },
    summary: "",
    experiences: [],
    educations: [],
    projects: [],
    skills: [],
    style: defaultStyle()
  };
}

export function defaultStyle(): NonNullable<ApiDraftContent["style"]> {
  return {
    accentColor: "#1a1a1a",
    sectionDivider: "solid",
    fontFamily: "serif",
    headerAlignment: "center"
  };
}

// sampleDraftContent returns a coherent, complete-looking resume so a
// brand-new user opens the builder onto a real example instead of an
// empty form. Every section is populated — Personal, Summary, two
// Experiences (one current, one past), one Education, three Skill
// groups, two Projects (one with link). Style stays at defaults so the
// preview shows the canonical look.
//
// Replace the values, don't add new sections — keep this in lockstep
// with the form sections so the user sees exactly what they can edit.
export function sampleDraftContent(): ApiDraftContent {
  return {
    personal: {
      name: "Anya Sharma",
      headline: "Senior Software Engineer · Backend",
      email: "anya@example.com",
      phone: "+91 98765 43210",
      location: "Bengaluru, IN",
      linkedinUrl: "linkedin.com/in/anyasharma",
      githubUrl: "github.com/anyasharma",
      websiteUrl: ""
    },
    summary:
      "Backend engineer with 6+ years building reliable distributed systems at scale. Specialized in Go and Postgres, with a track record of cutting tail latency, owning observability rollouts, and mentoring teams through complex migrations.",
    experiences: [
      {
        company: "Acme Corp",
        title: "Senior Software Engineer",
        location: "Bengaluru, IN",
        startDate: "Jan 2024",
        endDate: "",
        current: true,
        description: [
          "Led the migration of the payments service from monolith to event-driven microservices, cutting p99 checkout latency from 1.4s to 320ms.",
          "Designed the rollout strategy for a 50M-row Postgres schema change with zero downtime; ran the playbook and trained 4 engineers to repeat it.",
          "Mentored 3 mid-level engineers — two were promoted within the year."
        ]
      },
      {
        company: "Northwind Labs",
        title: "Software Engineer",
        location: "Pune, IN",
        startDate: "Jun 2019",
        endDate: "Dec 2023",
        current: false,
        description: [
          "Built the company's first observability stack on OpenTelemetry — adopted by every backend team within 6 months.",
          "Shipped a SaaS billing service from scratch (Stripe + invoicing), generating $4M ARR in its first year.",
          "Owned on-call for the public API; reduced page volume 70% by closing root causes instead of patching symptoms."
        ]
      }
    ],
    educations: [
      {
        school: "Indian Institute of Technology, Bombay",
        degree: "B.Tech",
        field: "Computer Science",
        startDate: "2015",
        endDate: "2019",
        gpa: "8.9 / 10",
        description: ""
      }
    ],
    projects: [
      {
        name: "pgflight",
        description:
          "Open-source migration runner for Postgres with online schema-change support. 1.2k stars on GitHub.",
        techStack: "Go, Postgres",
        link: "github.com/anyasharma/pgflight"
      },
      {
        name: "Latency Lens",
        description:
          "Internal tool that visualises tail-latency regressions across service deploys; adopted as the default review check before each release.",
        techStack: "TypeScript, ClickHouse",
        link: ""
      }
    ],
    skills: [
      {
        category: "Languages",
        items: ["Go", "Python", "TypeScript", "SQL"]
      },
      {
        category: "Infrastructure",
        items: ["Postgres", "Kafka", "Kubernetes", "Terraform", "AWS"]
      },
      {
        category: "Practices",
        items: ["Distributed systems", "Observability", "On-call engineering"]
      }
    ],
    style: defaultStyle()
  };
}

// fromProfile fetches the user's profile (and /me for the name + email)
// and shapes it into a DraftContent ready for the editor. Maps the
// profile sub-resources one-for-one into the draft sections so the user
// doesn't retype anything. Returns the result without persisting — the
// caller decides when to create the actual draft row.
export async function fromProfile(): Promise<ApiDraftContent> {
  const [me, profile] = await Promise.all([
    getMe(),
    api.get<ApiProfile>("/job-tracker/profile").catch(() => null)
  ]);

  const personal: ApiDraftContent["personal"] = {
    name: me?.name ?? "",
    email: me?.email ?? "",
    headline: profile?.headline ?? "",
    location: profile?.location ?? "",
    linkedinUrl: profile?.linkedinUrl ?? "",
    githubUrl: profile?.githubUrl ?? "",
    websiteUrl: profile?.websiteUrl ?? ""
  };

  const experiences: ApiDraftExperience[] = (profile?.experiences ?? []).map((e) => ({
    company: e.company,
    title: e.title,
    location: e.location ?? "",
    startDate: e.startDate ?? "",
    endDate: e.endDate ?? "",
    current: e.current,
    // Profile.description is free-form text — split on newlines to get
    // bullet candidates. Users can re-split / merge inside the editor.
    description: (e.description ?? "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }));

  const educations: ApiDraftEducation[] = (profile?.educations ?? []).map((e) => ({
    school: e.school,
    degree: e.degree ?? "",
    field: e.field ?? "",
    startDate: e.startDate ?? "",
    endDate: e.endDate ?? "",
    gpa: e.gpa ?? "",
    description: e.description ?? ""
  }));

  const projects: ApiDraftProject[] = (profile?.projects ?? []).map((p) => ({
    name: p.name,
    description: p.description ?? "",
    techStack: p.techStack ?? "",
    link: p.link ?? ""
  }));

  // Profile.skills is a flat list with optional .category. Group by category
  // (uncategorised → "Other") so the draft's skill-groups shape matches the
  // LaTeX template's bucket-per-category layout.
  const groups = new Map<string, string[]>();
  for (const s of profile?.skills ?? []) {
    const cat = (s.category ?? "").trim() || "Other";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(s.name);
  }
  const skills: ApiDraftSkillGroup[] = Array.from(groups, ([category, items]) => ({
    category,
    items
  }));

  return {
    personal,
    summary: profile?.about ?? "",
    experiences,
    educations,
    projects,
    skills,
    style: defaultStyle()
  };
}
