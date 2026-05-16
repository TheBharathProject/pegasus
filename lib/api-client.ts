// Single fetch wrapper for sypher-api. Attaches Authorization header from
// localStorage, normalises errors, throws on non-2xx.
import { getToken, clearToken } from "./auth";
import { withBase } from "./paths";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

export const apiBaseUrl = (): string => BASE_URL;

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type RequestInitWithBody = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipAuth?: boolean;
  rawResponse?: boolean;
};

// emitCreditBlocked fires a single AnalyticsEvent for a 402 response.
// Dynamic import avoids a hard dependency cycle (lib/analytics.ts has
// no imports today, but this keeps it strictly tree-shakeable).
async function emitCreditBlocked(path: string): Promise<void> {
  try {
    const { track } = await import("@/lib/analytics");
    // Strip the leading "/job-tracker/" so the feature label reads
    // naturally in GA (e.g. "ai/resume/report", "ai/resume/tweaks").
    const feature = path.replace(/^\/?job-tracker\//, "");
    track({ name: "ai_credit_blocked", params: { feature } });
  } catch {
    // Analytics is best-effort; never block the throw path.
  }
}

async function request<T = unknown>(path: string, init: RequestInitWithBody = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!init.skipAuth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let body: BodyInit | undefined;
  if (init.body !== undefined && init.body !== null) {
    if (init.body instanceof FormData || typeof init.body === "string") {
      body = init.body as BodyInit;
    } else {
      body = JSON.stringify(init.body);
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    }
  }

  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, { ...init, body, headers });

  if (res.status === 401) {
    clearToken();
    // For authenticated requests, bounce the user to /login. Public
    // requests (skipAuth) stay silent — they may legitimately 401 (e.g.
    // a misconfigured public profile) without warranting a redirect.
    if (!init.skipAuth && typeof window !== "undefined") {
      const loginPath = withBase("/login");
      const onLogin = window.location.pathname.startsWith(loginPath);
      if (!onLogin) {
        window.location.href = `${loginPath}?expired=1`;
      }
    }
  }

  if (init.rawResponse) {
    if (!res.ok) {
      throw new ApiError(res.status, "http_error", `HTTP ${res.status}`);
    }
    return res as unknown as T;
  }

  const contentType = res.headers.get("Content-Type") || "";
  let payload: unknown = null;
  if (contentType.includes("application/json")) {
    payload = await res.json().catch(() => null);
  } else if (res.status !== 204) {
    payload = await res.text().catch(() => "");
  }

  if (!res.ok) {
    const p = payload as { error?: string; message?: string } | null;
    // Fire-and-forget analytics for credit-blocked AI calls. Identified
    // by HTTP 402 + the canonical `insufficient_credits` error code the
    // BE returns from gateAICredit. The `feature` is best-effort from
    // the request path (e.g. "/job-tracker/ai/resume/report").
    if (res.status === 402 && p?.error === "insufficient_credits") {
      void emitCreditBlocked(path);
    }
    throw new ApiError(res.status, p?.error || "http_error", p?.message || `HTTP ${res.status}`);
  }

  return payload as T;
}

export const api = {
  get: <T = unknown>(path: string, init?: RequestInitWithBody) =>
    request<T>(path, { ...init, method: "GET" }),
  post: <T = unknown>(path: string, body?: unknown, init?: RequestInitWithBody) =>
    request<T>(path, { ...init, method: "POST", body }),
  put: <T = unknown>(path: string, body?: unknown, init?: RequestInitWithBody) =>
    request<T>(path, { ...init, method: "PUT", body }),
  patch: <T = unknown>(path: string, body?: unknown, init?: RequestInitWithBody) =>
    request<T>(path, { ...init, method: "PATCH", body }),
  delete: <T = unknown>(path: string, init?: RequestInitWithBody) =>
    request<T>(path, { ...init, method: "DELETE" }),
  raw: (path: string, init?: RequestInitWithBody) =>
    request<Response>(path, { ...init, rawResponse: true }),
};

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  pictureUrl?: string;
  timezone: string;
  // Premium flag + per-user email opt-in. Free users have isPremium=false
  // and the toggle is hidden from Settings (replaced with an Upgrade CTA);
  // see docs/adr/0002-premium-email-gating.md (D4).
  isPremium: boolean;
  emailNotificationsEnabled: boolean;
};

// Browser-extension token row. Plaintext is only available immediately
// after issuance (POST /me/api-token returns it once); the listing
// endpoint and every subsequent fetch carries only the prefix + meta.
export type ApiAPIToken = {
  id: string;
  prefix: string;
  label?: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
};

// Razorpay-backed billing snapshot from GET /billing/me. `premium` is
// null when the user is on the free tier; `creditsBalance` is always
// present (zero for new users). recentActivity merges sub events +
// credit transactions in created_at order.
export type ApiBillingPremium = {
  id: string;
  kind: "recurring" | "one_time";
  // planTier discriminates pricing within recurring:
  //   "standard" — ₹99/mo, premium only
  //   "plus"     — ₹299/mo, premium + 200 credits granted per charge
  // One-time rows always carry "standard".
  planTier: "standard" | "plus";
  status: "pending" | "active" | "halted" | "cancelled" | "expired";
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  amountPaise: number;
};

export type ApiBillingActivity = {
  when: string;
  kind: "subscription" | "credits";
  summary: string;
  amount: number;
};

export type ApiBillingMe = {
  premium: ApiBillingPremium | null;
  creditsBalance: number;
  recentActivity: ApiBillingActivity[];
  creditPacks: { id: string; label: string; amountPaise: number; credits: number }[];
};

export type ApiStageChange = {
  from?: string;        // empty/missing on the initial "added" entry
  to: string;
  changedAt: string;    // RFC3339
};

export type ApiApplication = {
  id: string;
  company: string;
  role: string;
  source?: string;
  location?: string;
  salaryRange?: string;
  stage: string;
  appliedAt?: string;
  applyDeadline?: string;
  jobLink?: string;
  jobDescription?: string;
  notes?: string;
  stale: boolean;
  stageChangedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiDashboard = {
  total: number;
  inPipeline: number;
  interviews: number;
  offers: number;
  addedThisWeek: number;
  responseRate: number;
  conversionRate: number;
};

// Full note record — returned by GET /notes/{id}, POST /notes, PUT /notes/{id}.
export type ApiNote = {
  id: string;
  categoryId?: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

// Slim list shape — returned by GET /notes (no full content, just an excerpt).
export type ApiNoteListItem = {
  id: string;
  categoryId?: string;
  title: string;
  excerpt: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiCategory = {
  id: string;
  name: string;
  color?: string;
};

export type ApiExperience = {
  id: string;
  company: string;
  title: string;
  location?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;
  current: boolean;
  description?: string;
  sortOrder: number;
};

export type ApiEducation = {
  id: string;
  school: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
  description?: string;
  sortOrder: number;
};

export type ApiProject = {
  id: string;
  name: string;
  description?: string;
  techStack?: string;
  link?: string;
  sortOrder: number;
};

export type ApiSkill = {
  id: string;
  name: string;
  category?: string;
  sortOrder: number;
};

export type ApiProfile = {
  slug?: string;
  isPublic: boolean;
  headline?: string;
  about?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  experiences: ApiExperience[];
  educations: ApiEducation[];
  projects: ApiProject[];
  skills: ApiSkill[];
};

export type ApiPublicProfile = {
  slug: string;
  name: string;
  pictureUrl?: string;
  headline?: string;
  about?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  experiences: ApiExperience[];
  educations: ApiEducation[];
  projects: ApiProject[];
  skills: ApiSkill[];
};

export type ApiFile = {
  id: string;
  kind: "resume" | "cover_letter";
  slot?: number;
  label?: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  uploadedAt?: string;
  createdAt: string;
};

export type ApiResumesResponse = {
  resumes: ApiFile[];
  count: number;
  limit: number;
};

// Notification (Phase 2). Server returns ISO-8601 strings for the
// timestamps; readAt is omitted when the row is unread.
export type ApiNotification = {
  id: string;
  kind: string;        // "app_stale" | "app_deadline" | "community_reply" | "digest" | future
  refType?: string;
  refId?: string;
  title: string;
  body?: string;
  linkPath?: string;
  readAt?: string;
  createdAt: string;
};

export type ApiNotificationListResponse = {
  items: ApiNotification[];
  nextCursor: string | null;
};

// Community (Phase 3). Single-table model — surface field discriminates,
// metadata holds per-surface fields as opaque JSON.
export type ApiCommunityPost = {
  id: string;
  userId: string;
  authorName: string;
  authorSlug?: string;
  slug: string;
  surface: "reviews" | "experiences" | "referrals" | "ask" | "recruiters";
  title: string;
  body?: string;
  metadata: Record<string, unknown>;
  isPublic: boolean;
  voteCount: number;
  commentCount: number;
  status: "active" | "removed" | "flagged";
  myVote: -1 | 0 | 1;
  createdAt: string;
  updatedAt: string;
};

export type ApiCommunityListResponse = {
  items: ApiCommunityPost[];
  nextCursor: string | null;
};

export type ApiCommunityComment = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  authorSlug?: string;
  parentId?: string;
  body: string;
  status: "active" | "removed" | "flagged";
  createdAt: string;
};

export type ApiCommunityCommentListResponse = {
  items: ApiCommunityComment[];
};

export type ApiCoverLettersResponse = {
  coverLetters: ApiFile[];
  count: number;
  limit: number;
};

export type ApiRecruiter = {
  id: string;
  name: string;
  email: string;
  company?: string;
  linkedinUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

// Phone is served by a dedicated rate-limited endpoint
// (GET /job-tracker/recruiters/{id}/phone) to protect sensitive contact data.
// Limits: 5 reveals per 5 minutes, 20 per day. Server returns 429 on excess.
export type ApiRecruiterPhone = {
  phone: string | null;
};

// company / role come from the ListReminders join (Activity panel).
// They are absent on single-row endpoints (Get/Create/Patch) — that's why
// they're optional, not required.
export type ApiReminder = {
  id: string;
  applicationId: string;
  company?: string;
  role?: string;
  triggersAt: string;
  note?: string;
  firedAt?: string;
  createdAt: string;
  updatedAt: string;
};

// Resume Score — structured score-report types. Wire shape matches
// ai.ScoreReport in sypher-api/internal/ai/types.go.

export type ApiFindingTag = "fix" | "improve" | "good";

export type ApiScoreFinding = {
  tag: ApiFindingTag;
  text: string;
};

export type ApiScoreSection = {
  score: number;
  findings: ApiScoreFinding[];
};

// v2 verdict / checklist / improvement-plan types.
export type ApiVerdictPile = "yes" | "maybe" | "no";

export type ApiChecklistStatus = "pass" | "warn" | "fail" | "na";

export type ApiChecklistGroup =
  | "common_mistakes"
  | "dos_donts"
  | "stands_out";

export type ApiChecklistItem = {
  id: string;
  title: string;
  group: ApiChecklistGroup;
  status: ApiChecklistStatus;
  evidence: string;
};

export type ApiEffort = "low" | "medium" | "high";
export type ApiImpact = "low" | "medium" | "high";

export type ApiImprovementPlanItem = {
  title: string;
  where: string;
  effort: ApiEffort;
  impact: ApiImpact;
  before: string;
  after: string;
  // v2.1: the principle behind the rewrite so the candidate can
  // generalise it ("adds baseline so the % means something").
  why?: string;
};

// v2.1: diagnosis-first block borrowed from the resume-analyzer skill.
// Anchors the report — rendered at the very top of the Results step.
export type ApiIdentityMatch = "match" | "mismatch" | "unclear";
export type ApiArchetype =
  | "identity_crisis"
  | "underseller"
  | "overseller"
  | "list_of_jobs"
  | "duty_lister"
  | "career_changer"
  | "long_in_the_tooth"
  | "junior_looking_senior"
  | "senior_looking_junior"
  | "tool_lister"
  | "";

export type ApiCoreDiagnosis = {
  six_second_verdict: string;
  identity_match: ApiIdentityMatch;
  archetype?: ApiArchetype;
  hidden_story: string;
  core_problem: string;
};

export type ApiScoreReport = {
  overall_score: number;
  // v2-only fields below. v1 reports leave these undefined/empty;
  // FE/PDF render layers detect v2 via (ats_score > 0 && checklist.length > 0).
  ats_score?: number;
  verdict_pile?: ApiVerdictPile;
  verdict_tagline?: string;
  // v2.1: diagnosis block. Optional — earlier v2 reports lack it.
  core_diagnosis?: ApiCoreDiagnosis;
  executive_summary: string;
  // Section keys are stable strings — see SECTION_ORDER in components/resume-score.
  sections: Record<string, ApiScoreSection>;
  checklist?: ApiChecklistItem[];
  improvement_plan?: ApiImprovementPlanItem[];
};

// ApiAIReport mirrors the full row shape from GET /ai/resume/report/latest
// and GET /ai/resume/reports/{id}. The `format` discriminator tells the FE
// whether to render `reportMd` (legacy Markdown), `reportJson` (new
// structured Resume Score), or show a loader when the async generation
// hasn't completed yet (`pending`).
export type ApiAIReport = {
  id: string;
  resumeFileId?: string;
  draftId?: string;
  format: "json" | "md" | "pending";
  reportMd?: string;
  reportJson?: ApiScoreReport;
  score: number;
  createdAt: string;
};

// ApiAIReportSummary is the lightweight row shape for the list endpoint.
// No body — fetch the full report by id when the user drills in.
export type ApiAIReportSummary = {
  id: string;
  resumeFileId?: string;
  resumeFilename?: string;
  draftId?: string;
  format: "json" | "md" | "pending";
  score: number;
  createdAt: string;
};

export type ApiAIReportsResponse = {
  items: ApiAIReportSummary[];
  nextCursor?: string | null;
};

export type ApiApplicationPage = {
  items: ApiApplication[];
  nextCursor?: string;
};

// ============================================================================
// Resume Builder — types mirror backend internal/jobtracker/types.go
// (DraftContent + ResumeBuilderDraft + ResumeBuilderDraftSummary).
// ============================================================================

export type ApiDraftPersonal = {
  name: string;
  headline?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
};

export type ApiDraftExperience = {
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
  description?: string[];
};

export type ApiDraftEducation = {
  school: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
  description?: string;
};

export type ApiDraftProject = {
  name: string;
  description?: string;
  techStack?: string;
  link?: string;
};

export type ApiDraftSkillGroup = {
  category: string;
  items: string[];
};

// User-tweakable visual options. All fields optional; missing values fall
// back to the v1 defaults at render time (both preview + LaTeX).
export type ApiDraftStyle = {
  accentColor?: string;                          // "#1a1a1a" default
  sectionDivider?: "solid" | "dashed" | "none";  // "solid" default
  // Font family — paired between HTML preview and the LaTeX compile so
  // both sides use the same family. See lib/resume-builder/font-registry.ts
  // for the full list. "serif" / "sans" are legacy aliases kept for older
  // drafts; normalizeFontFamily() maps them on read.
  fontFamily?:
    | "lmodern"
    | "helvetica"
    | "times"
    | "palatino"
    | "charter"
    | "ebgaramond"
    | "serif"
    | "sans";
  headerAlignment?: "center" | "left";           // "center" default
};

export type ApiDraftContent = {
  personal: ApiDraftPersonal;
  summary?: string;
  experiences?: ApiDraftExperience[];
  educations?: ApiDraftEducation[];
  projects?: ApiDraftProject[];
  skills?: ApiDraftSkillGroup[];
  style?: ApiDraftStyle;
  // When non-empty, the export pipeline ships this exact .tex string and
  // skips template rendering. The form-driven fields stay populated so
  // switching back to "Form" mode discards CustomTeX and re-derives.
  customTex?: string;
};

export type ApiResumeBuilderDraft = {
  id: string;
  title: string;
  templateId: string;
  content: ApiDraftContent;
  createdAt: string;
  updatedAt: string;
};

export type ApiResumeBuilderDraftSummary = {
  id: string;
  title: string;
  templateId: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiResumeBuilderDraftsResponse = {
  items: ApiResumeBuilderDraftSummary[];
};

export async function downloadPDF(
  endpoint: string,
  body: Record<string, unknown> | null,
  filename: string
): Promise<void> {
  const token = getToken();
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";
  const opts: RequestInit = {
    method: body !== null ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token ?? ""}`,
      ...(body !== null ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== null ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(`${base}${endpoint}`, opts);
  if (!res.ok) throw new Error(`PDF download failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
