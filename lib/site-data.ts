export type ApplicationStage =
  | "INTERESTED"
  | "APPLIED"
  | "PHONE_SCREEN"
  | "TECHNICAL"
  | "ONSITE"
  | "OFFER"
  | "REJECTED";

export type Application = {
  id: number;
  company: string;
  role: string;
  source: string;
  location: string | null;
  salaryRange: string | null;
  stage: ApplicationStage;
  appliedAt: string;
  applyDeadline: string | null;
  stale: boolean;
  notes: string | null;
};

export type ResumeItem = {
  id: number;
  fileName: string;
  fileSize: number;
  label: string;
  uploadedAt: string;
};

export type NotePreview = {
  id: number;
  categoryId: number | null;
  title: string;
  excerpt: string;
  pinned: boolean;
  updatedAt: string;
};

export type BlogSection = {
  heading?: string;
  paragraphs: string[];
  bullets?: string[];
};

export type BlogPost = {
  slug: string;
  date: string;
  readTime: string;
  title: string;
  excerpt: string;
  tags: string[];
  content: BlogSection[];
};

export type CommunityExperience = {
  id: number;
  slug: string;
  author: string;
  company: string;
  role: string;
  location: string;
  outcome: string;
  difficulty: string;
  roundCount: number;
  voteCount: number;
  commentCount: number;
  createdAt: string;
};

export type PublicProfile = {
  slug: string;
  name: string;
  headline: string;
  location: string;
  about: string;
  skills: string[];
  experiences: Array<{
    company: string;
    title: string;
    period: string;
    summary: string;
  }>;
  educations: Array<{
    school: string;
    degree: string;
    period: string;
  }>;
  projects: Array<{
    name: string;
    summary: string;
  }>;
};

export const homePreviewApplications = [
  { company: "Stripe", role: "Backend Engineer", stage: "Interview" },
  { company: "Figma", role: "Full Stack", stage: "Screen" },
  { company: "Linear", role: "iOS Engineer", stage: "Applied" },
  { company: "Notion", role: "DevX", stage: "Offer" }
];

export const homeFeatures = [
  {
    title: "Track every application",
    body: "Company, role, stage, salary, notes, dates. One row per application — no more 14-tab spreadsheet."
  },
  {
    title: "Remember every recruiter",
    body: "Who you spoke to, when, and what they said. Never re-introduce yourself by accident."
  },
  {
    title: "See your whole pipeline",
    body: "Dashboard with everything live: what's in screening, what's awaiting reply, what's gone cold."
  },
  {
    title: "Quiet by design",
    body: "No notifications begging for attention. No streaks. No gamification. Just your data, when you want it."
  },
  {
    title: "Yours, always",
    body: "Your data lives in your account, encrypted in transit, never sold, never shared. Export or delete anytime."
  },
  {
    title: "Free, forever",
    body: "Built by one person who hated job tracking. Free now, free later. No credit card, no trial."
  }
];

export const homePersonas = [
  {
    name: "The new grad",
    line: "First-time job hunter, 50 applications open, can't remember which ones replied.",
    quote: "Finally I know what I applied to last Tuesday."
  },
  {
    name: "The switcher",
    line: "3 years in, talking to 5 companies in parallel, juggling notice periods and counter-offers.",
    quote: "My pipeline finally makes sense again."
  },
  {
    name: "The seasoned pro",
    line: "Senior engineer fielding recruiter pings, only interested in 1 in 20.",
    quote: "One place to filter the noise."
  }
];

export const homeFaqs = [
  {
    q: "Is Naukri Clear really free?",
    a: "Yes, completely. There's no trial, no credit card, no premium tier hidden behind features. It's a personal project run by one person and offered for free to fellow job seekers."
  },
  {
    q: "How is this different from a spreadsheet?",
    a: "You can do everything Naukri Clear does in a spreadsheet — if you have the patience to maintain one. We're built for people who don't. Pipeline views, recruiter contacts, notes, and dates are all wired together so you never have to re-enter the same thing twice."
  },
  {
    q: "Will Naukri Clear send emails for me?",
    a: "No. We don't read your inbox and we don't send mail on your behalf. Your Gmail stays untouched. The only thing we do with Google is sign you in."
  },
  {
    q: "Where is my data stored?",
    a: "In a managed PostgreSQL database, encrypted in transit, accessible only by your authenticated session. We don't sell it, share it, or use it for ads. You can export or delete everything any time."
  },
  {
    q: "Can I import from Naukri.com / LinkedIn / spreadsheets?",
    a: "Not yet — bulk import is on the roadmap. For now, applications are added one at a time. Most users find this surprisingly fast: 30 seconds per application."
  },
  {
    q: "Who built this?",
    a: "Jaan Mustafa, an engineer currently working at ClearTax. Built because he was tired of losing track of his own job applications during a switch and couldn't find a tool that wasn't either bloated CRM software or a $20/month SaaS."
  }
];

export const marketingFeatures = [
  {
    title: "Track every application",
    body: "Company, role, stage, salary, notes, dates. One row per application so you stop living in a 14-tab spreadsheet."
  },
  {
    title: "Remember every recruiter",
    body: "Track who you spoke to, when they replied, and what they promised without rebuilding the thread from memory."
  },
  {
    title: "See your whole pipeline",
    body: "Dashboards, weekly activity, source breakdowns, and stale application lists show what is moving and what is dying."
  },
  {
    title: "Quiet by design",
    body: "No streaks, no spam, no dopamine loops. The interface stays calm and your data stays primary."
  },
  {
    title: "Yours, always",
    body: "Profile visibility, export/import, and delete-anytime messaging are part of the core product language."
  },
  {
    title: "Free with a pro layer",
    body: "The live product markets itself as free, while the API and settings surface show AI and billing capabilities for pro accounts."
  }
];

export const personas = [
  {
    title: "The new grad",
    body: "Fifty open applications, callback panic, and no durable memory of which recruiter emailed last Tuesday."
  },
  {
    title: "The switcher",
    body: "Multiple live processes, offer sequencing, notice periods, and the constant need to compare paths side by side."
  },
  {
    title: "The seasoned pro",
    body: "Lots of inbound noise, selective interest, and a need for one place to keep only the conversations that matter."
  }
];

export const faqs = [
  {
    question: "Is Naukri Clear really free?",
    answer: "The homepage positions the tracker as free for job seekers. The authenticated API also exposes pro billing and AI usage features."
  },
  {
    question: "How is it different from a spreadsheet?",
    answer: "The product combines structured stages, analytics, notes, recruiter context, resume management, community surfaces, and extension-based capture."
  },
  {
    question: "Will it send emails for me?",
    answer: "No evidence of outbound recruiter automation appeared in the live product. The tone of the site explicitly avoids aggressive automation."
  },
  {
    question: "Can I import jobs?",
    answer: "Yes. The frontend bundle includes application import, preview, export, and template routes."
  }
];

export const dashboardSummary = {
  total: 1,
  inPipeline: 1,
  interviews: 0,
  offers: 0,
  addedThisWeek: 1,
  responseRate: 0,
  conversionRate: 0
};

export const funnel = [
  { stage: "INTERESTED", count: 1 },
  { stage: "APPLIED", count: 0 },
  { stage: "PHONE_SCREEN", count: 0 },
  { stage: "TECHNICAL", count: 0 },
  { stage: "ONSITE", count: 0 },
  { stage: "OFFER", count: 0 },
  { stage: "REJECTED", count: 0 }
];

export const weeklyActivity = [
  { weekStart: "2026-05-04", count: 1 },
  { weekStart: "2026-04-27", count: 0 },
  { weekStart: "2026-04-20", count: 0 },
  { weekStart: "2026-04-13", count: 0 },
  { weekStart: "2026-04-06", count: 0 },
  { weekStart: "2026-03-30", count: 0 }
];

export const sourceBreakdown = [
  {
    source: "LinkedIn",
    total: 1,
    interviews: 0,
    interviewRate: 0
  }
];

export const applications: Application[] = [
  {
    id: 239,
    company: "CClear",
    role: "SDET",
    source: "LinkedIn",
    location: "Bengaluru",
    salaryRange: null,
    stage: "INTERESTED",
    appliedAt: "2025-12-01",
    applyDeadline: "2026-12-21",
    stale: false,
    notes: "Saved from the browser clipper while comparing QA-heavy roles."
  },
  {
    id: 240,
    company: "Notion",
    role: "DevX Engineer",
    source: "Career Page",
    location: "Remote",
    salaryRange: "28L - 38L",
    stage: "PHONE_SCREEN",
    appliedAt: "2026-04-21",
    applyDeadline: null,
    stale: false,
    notes: "Need to tailor the systems examples before the next round."
  },
  {
    id: 241,
    company: "Figma",
    role: "Frontend Platform",
    source: "Referral",
    location: "Bengaluru",
    salaryRange: "32L - 45L",
    stage: "TECHNICAL",
    appliedAt: "2026-04-09",
    applyDeadline: null,
    stale: false,
    notes: "Resume version: ui-platform-v3.pdf."
  },
  {
    id: 242,
    company: "Linear",
    role: "Product Engineer",
    source: "LinkedIn",
    location: "Remote",
    salaryRange: null,
    stage: "REJECTED",
    appliedAt: "2026-03-18",
    applyDeadline: null,
    stale: true,
    notes: "Useful for source analytics even after closure."
  }
];

export const resumes: ResumeItem[] = [
  {
    id: 14,
    fileName: "ShubhamDixitResume.pdf",
    fileSize: 125504,
    label: "SDET",
    uploadedAt: "2026-05-05T16:04:38.762496Z"
  },
  {
    id: 15,
    fileName: "frontend-platform-v3.pdf",
    fileSize: 118942,
    label: "Frontend",
    uploadedAt: "2026-04-28T10:21:12.000000Z"
  },
  {
    id: 16,
    fileName: "qa-automation-senior.pdf",
    fileSize: 133108,
    label: "QA",
    uploadedAt: "2026-04-11T08:40:05.000000Z"
  }
];

export const notes: NotePreview[] = [
  {
    id: 2,
    categoryId: 10,
    title: "Extension capture ideas",
    excerpt: "Save recruiter context directly from clipped jobs and auto-link it to companies.",
    pinned: false,
    updatedAt: "2026-05-05T16:07:51.209673Z"
  },
  {
    id: 1,
    categoryId: null,
    title: "Interview follow-ups",
    excerpt: "Use a calmer template for scheduling nudges instead of rewriting the same email every time.",
    pinned: false,
    updatedAt: "2026-05-05T16:07:27.697694Z"
  }
];

export const quickModules = [
  {
    title: "Recruiter contacts",
    body: "The live copy and API bundle both point to recruiter tracking as a first-class feature, distinct from applications."
  },
  {
    title: "Resume vault",
    body: "Upload labeled resume versions, extract content, generate reports, and attach the right version to each job."
  },
  {
    title: "Cover letters",
    body: "Dedicated cover-letter endpoints exist alongside AI generation and file upload support."
  },
  {
    title: "Templates",
    body: "A stored template library likely powers reusable outreach, notes, or document presets."
  }
];

export const settingsSnapshot = {
  name: "Shubham Dixit",
  email: "dixit.shubh18@gmail.com",
  timezone: "Asia/Calcutta",
  plan: "pro",
  aiUsed: 2,
  aiLimit: 50,
  extensionTokenPrefix: "nc_",
  isCancelled: false
};

export const communityExperiences: CommunityExperience[] = [
  {
    id: 2,
    slug: "nagarro-data-science-54da",
    author: "Shahrukh Khan",
    company: "Nagarro",
    role: "Data Science",
    location: "Gurgaon",
    outcome: "Offer",
    difficulty: "Medium",
    roundCount: 4,
    voteCount: 1,
    commentCount: 0,
    createdAt: "2026-04-25T06:48:37.523594Z"
  },
  {
    id: 1,
    slug: "clear-cleartax-sde-intern-86ca",
    author: "Md Rizabul",
    company: "Clear (ClearTax)",
    role: "SDE Intern",
    location: "Bengaluru",
    outcome: "Offer",
    difficulty: "Hard",
    roundCount: 3,
    voteCount: 1,
    commentCount: 0,
    createdAt: "2026-04-25T06:23:50.333521Z"
  }
];

export const askTags = [
  "career-advice",
  "salary",
  "negotiation",
  "interview-prep",
  "offer-comparison",
  "resume",
  "dsa",
  "system-design",
  "startup-vs-mnc",
  "remote-work"
];

export const blogPosts: BlogPost[] = [
  {
    slug: "save-jobs-with-chrome-extension",
    date: "20 April 2026",
    readTime: "5 min read",
    title: "Save Any Job in One Click: A Guide to the Naukri Clear Extension",
    excerpt: "Install the browser extension once, clip from LinkedIn, Indeed, or Naukri in a few seconds, and push jobs straight into your tracker.",
    tags: ["extension", "productivity", "guide"],
    content: [
      {
        paragraphs: [
          "The live product includes a browser clipper workflow: save the current job posting, prefill company, role, location, salary, and description, then drop it into your tracker in a chosen stage.",
          "The extension stays pinned in a side panel, supports manual fallback for unsupported sites, stores drafts per URL, and detects duplicate saves."
        ]
      },
      {
        heading: "Observed extension flow",
        paragraphs: [
          "The article instructs users to sign in, load the unpacked extension from GitHub, generate an extension token from Settings, and connect with a token prefixed by nc_.",
          "The side panel re-extracts data as you switch job tabs and persists partial state locally so you do not lose notes during context switches."
        ],
        bullets: [
          "Supported auto-extraction targets: LinkedIn, Indeed, and Naukri",
          "Manual fallback for other job sites with URL capture",
          "Duplicate detection by job URL",
          "Stage picker and freeform notes while clipping"
        ]
      }
    ]
  },
  {
    slug: "how-to-track-job-applications",
    date: "18 April 2026",
    readTime: "8 min read",
    title: "How to Track Job Applications in 2026 (Without Losing Your Mind)",
    excerpt: "A calmer operating system for a messy job hunt: track stages, save context, and make the inbox less foggy.",
    tags: ["job search", "productivity", "guide"],
    content: [
      {
        paragraphs: [
          "The product positioning is consistent everywhere: a small operational layer for job hunting, not a sales CRM disguised for applicants.",
          "Tracking works best when it covers dates, stages, recruiter context, document versions, and a visible next step."
        ]
      },
      {
        heading: "What the tracker is optimized for",
        paragraphs: [
          "The dashboard API exposes total applications, pipeline counts, interview totals, offer totals, weekly activity, response rate, and conversion rate.",
          "That means the product is optimized for memory, prioritization, and trend visibility rather than gamified velocity."
        ]
      }
    ]
  },
  {
    slug: "resume-versions-strategy",
    date: "18 April 2026",
    readTime: "6 min read",
    title: "Why You Need 3–5 Resume Versions (And How to Manage Them)",
    excerpt: "Different roles need different narratives. The tracker reflects that by giving resume files labels, upload flows, extraction, and reporting hooks.",
    tags: ["resume", "job search", "strategy"],
    content: [
      {
        paragraphs: [
          "Resume management is not bolted on. The bundle exposes upload, extract, report, and latest-report routes, and the authenticated API returns labeled resume records.",
          "That structure maps cleanly to a resume vault where each job application can reference a specific version."
        ]
      }
    ]
  }
];

export const publicProfiles: PublicProfile[] = [
  {
    slug: "jaan",
    name: "Jaan",
    headline: "Builder of quiet tools for job hunters",
    location: "India",
    about: "Public profiles on the live site are intentionally restrained. This clone expands the profile so the route feels like a product surface rather than a placeholder.",
    skills: ["Product strategy", "Growth writing", "UI systems", "Community"],
    experiences: [
      {
        company: "Naukri Clear",
        title: "Founder",
        period: "2025 - Present",
        summary: "Building a tracker, a public community, and a browser clipper around a calmer job search workflow."
      }
    ],
    educations: [
      {
        school: "Independent builder path",
        degree: "Product and engineering",
        period: "Ongoing"
      }
    ],
    projects: [
      {
        name: "Naukri Clear",
        summary: "Job tracker, public profile system, community feed, resume review board, and extension workflow."
      }
    ]
  },
  {
    slug: "salwyn-mathew",
    name: "Salwyn Mathew",
    headline: "Frontend engineer with a bias toward systems",
    location: "Remote",
    about: "A stronger public profile example for the cloned site, showing how profile content can advertise work history, skills, and projects.",
    skills: ["React", "TypeScript", "Design systems", "Accessibility"],
    experiences: [
      {
        company: "Acme UI",
        title: "Frontend Engineer",
        period: "2023 - Present",
        summary: "Shipped cross-product component libraries and created editorial landing systems."
      }
    ],
    educations: [
      {
        school: "University of Design and Computing",
        degree: "B.Tech",
        period: "2018 - 2022"
      }
    ],
    projects: [
      {
        name: "Palette Audit",
        summary: "An interface tool for finding contrast and spacing drift in complex design systems."
      }
    ]
  }
];

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}

export function getPublicProfile(slug: string) {
  return publicProfiles.find((profile) => profile.slug === slug);
}
