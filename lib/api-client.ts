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
