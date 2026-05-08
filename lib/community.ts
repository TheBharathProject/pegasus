// Community API helpers — typed wrappers around the api client. Plus a
// surface-specific metadata builder that maps the modal form state in
// app/community/[section]/page.tsx into the {surface, title, body,
// metadata} shape the backend expects.

import {
  api,
  type ApiCommunityComment,
  type ApiCommunityCommentListResponse,
  type ApiCommunityListResponse,
  type ApiCommunityPost
} from "@/lib/api-client";

export type CommunitySurface =
  | "reviews"
  | "experiences"
  | "referrals"
  | "ask"
  | "recruiters";

// =============================================================================
// List + detail
// =============================================================================

export async function listCommunityPosts(
  surface: CommunitySurface,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<ApiCommunityListResponse> {
  const params = new URLSearchParams();
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.limit) params.set("limit", String(opts.limit));
  const q = params.toString() ? `?${params.toString()}` : "";
  return api.get<ApiCommunityListResponse>(`/job-tracker/community/${surface}${q}`);
}

export async function getCommunityPost(postId: string): Promise<ApiCommunityPost> {
  return api.get<ApiCommunityPost>(`/job-tracker/community/posts/${postId}`);
}

// =============================================================================
// Mutations
// =============================================================================

type CreatePostPayload = {
  title: string;
  body?: string;
  metadata: Record<string, unknown>;
  isPublic: boolean;
};

export async function createCommunityPost(
  surface: CommunitySurface,
  payload: CreatePostPayload
): Promise<ApiCommunityPost> {
  return api.post<ApiCommunityPost>(`/job-tracker/community/${surface}`, payload);
}

export async function voteCommunityPost(
  postId: string,
  value: -1 | 0 | 1
): Promise<void> {
  await api.post(`/job-tracker/community/posts/${postId}/vote`, { value });
}

export async function softDeleteCommunityPost(postId: string): Promise<void> {
  await api.delete(`/job-tracker/community/posts/${postId}`);
}

export async function flagCommunityPost(postId: string): Promise<void> {
  await api.post(`/job-tracker/community/posts/${postId}/flag`);
}

// =============================================================================
// Comments
// =============================================================================

export async function listCommunityComments(
  postId: string
): Promise<ApiCommunityCommentListResponse> {
  return api.get<ApiCommunityCommentListResponse>(
    `/job-tracker/community/posts/${postId}/comments`
  );
}

export async function createCommunityComment(
  postId: string,
  body: string,
  parentId?: string
): Promise<ApiCommunityComment> {
  return api.post<ApiCommunityComment>(
    `/job-tracker/community/posts/${postId}/comments`,
    { body, parentId }
  );
}

export async function softDeleteCommunityComment(commentId: string): Promise<void> {
  await api.delete(`/job-tracker/community/comments/${commentId}`);
}

// =============================================================================
// Surface-specific payload builders
// =============================================================================

// Each surface has its own modal draft state in
// app/community/[section]/page.tsx. These functions take whatever's in
// that draft and return the {title, body, metadata} payload for POST.

export function buildReviewPayload(d: {
  uploadMode: string;
  fileName: string;
  fileSizeKB: number;
  title: string;
  targetRole: string;
  level: string;
  feedback: string;
}): CreatePostPayload {
  return {
    title: d.title || "Resume for review",
    body: d.feedback,
    metadata: {
      uploadMode: d.uploadMode,
      fileName: d.fileName,
      fileSizeKB: d.fileSizeKB,
      targetRole: d.targetRole,
      level: d.level
    },
    isPublic: true
  };
}

export function buildExperiencePayload(d: {
  linkedApplication: string;
  company: string;
  role: string;
  yearsOfExperience: string;
  location: string;
  outcome: string;
  difficulty: string;
  rounds: Array<{ id: number; type: string; questions: string; tips: string }>;
  shareSalary: boolean;
  overallTips: string;
}): CreatePostPayload {
  return {
    title: `${d.company} · ${d.role}`,
    body: d.overallTips,
    metadata: {
      linkedApplication: d.linkedApplication,
      company: d.company,
      role: d.role,
      yearsOfExperience: d.yearsOfExperience,
      location: d.location,
      outcome: d.outcome,
      difficulty: d.difficulty,
      rounds: d.rounds,
      shareSalary: d.shareSalary
    },
    isPublic: true
  };
}

export function buildReferralPayload(d: {
  company: string;
  roles: string[];
  locations: string[];
  count: string;
  deadline: string;
  notes: string;
}): CreatePostPayload {
  return {
    title: `Referrals at ${d.company}`,
    body: d.notes,
    metadata: {
      company: d.company,
      roles: d.roles.filter(Boolean),
      locations: d.locations.filter(Boolean),
      count: d.count,
      deadline: d.deadline
    },
    isPublic: true
  };
}

export function buildAskPayload(d: {
  question: string;
  details: string;
  tags: string[];
}): CreatePostPayload {
  return {
    title: d.question,
    body: d.details,
    metadata: { tags: d.tags },
    isPublic: true
  };
}

export function buildRecruiterPayload(d: {
  recruiter: string;
  company: string;
  title: string;
  linkedinUrl: string;
  email: string;
  specializations: string[];
  hiringLevels: string[];
}): CreatePostPayload {
  return {
    title: `${d.recruiter} · ${d.company}`,
    body: undefined,
    metadata: {
      recruiter: d.recruiter,
      company: d.company,
      title: d.title,
      linkedinUrl: d.linkedinUrl,
      email: d.email,
      specializations: d.specializations,
      hiringLevels: d.hiringLevels
    },
    isPublic: true
  };
}
