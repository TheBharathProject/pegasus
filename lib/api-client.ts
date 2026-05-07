// Single fetch wrapper for sypher-api. Attaches Authorization header from
// localStorage, normalises errors, throws on non-2xx.
import { getToken, clearToken } from "./auth";

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
  description?: string;
  notes?: string;
  stale: boolean;
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

export type ApiNote = {
  id: string;
  categoryId?: string;
  title: string;
  body: string;
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
  period?: string;
  summary?: string;
  ordinal: number;
};

export type ApiEducation = {
  id: string;
  school: string;
  degree?: string;
  period?: string;
  ordinal: number;
};

export type ApiProject = {
  id: string;
  name: string;
  summary?: string;
  ordinal: number;
};

export type ApiSkill = {
  id: string;
  name: string;
  category?: string;
};

export type ApiProfile = {
  slug?: string;
  isPublic: boolean;
  headline?: string;
  about?: string;
  location?: string;
  experiences: ApiExperience[];
  educations: ApiEducation[];
  projects: ApiProject[];
  skills: ApiSkill[];
};

export type ApiPublicProfile = {
  slug: string;
  name: string;
  headline?: string;
  location?: string;
  about?: string;
  skills: string[];
  experiences: ApiExperience[];
  educations: ApiEducation[];
  projects: ApiProject[];
};
