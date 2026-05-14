// Resume Builder API client. Wraps the /job-tracker/resume-builder/* paths
// + the LaTeX render + save-to-Vault endpoints. Mirrors the shape in
// internal/jobtracker/handlers_resume_builder.go.

import {
  api,
  apiBaseUrl,
  ApiError,
  type ApiDraftContent,
  type ApiFile,
  type ApiResumeBuilderDraft,
  type ApiResumeBuilderDraftSummary,
  type ApiResumeBuilderDraftsResponse
} from "@/lib/api-client";
import { getToken } from "@/lib/auth";

const ROOT = "/job-tracker/resume-builder/drafts";

export async function listDrafts(): Promise<ApiResumeBuilderDraftSummary[]> {
  const res = await api.get<ApiResumeBuilderDraftsResponse>(ROOT);
  // Defensive against the API returning a shape without `items` (the Go
  // stdlib mux falls through to the root handler `{service, status, version}`
  // if the resume-builder routes aren't registered yet — i.e. the binary
  // wasn't restarted). Treat as empty so the UI shows the empty state
  // instead of crashing on .length later.
  return res?.items ?? [];
}

export async function getDraft(id: string): Promise<ApiResumeBuilderDraft> {
  return api.get<ApiResumeBuilderDraft>(`${ROOT}/${id}`);
}

export async function createDraft(input: {
  title: string;
  templateId?: string;
  content: ApiDraftContent;
}): Promise<ApiResumeBuilderDraft> {
  return api.post<ApiResumeBuilderDraft>(ROOT, input);
}

export async function saveDraft(
  id: string,
  patch: { title?: string; templateId?: string; content?: ApiDraftContent }
): Promise<ApiResumeBuilderDraft> {
  return api.patch<ApiResumeBuilderDraft>(`${ROOT}/${id}`, patch);
}

export async function deleteDraft(id: string): Promise<void> {
  await api.delete(`${ROOT}/${id}`);
}

// renderTex returns the raw .tex source. Useful for the "View source" link
// in the export modal — and useful in dev where Tectonic isn't installed.
export async function renderTex(id: string): Promise<string> {
  const token = getToken();
  const url = `${apiBaseUrl()}${ROOT}/${id}/render/tex`;
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, "render_failed", body || `HTTP ${res.status}`);
  }
  return res.text();
}

// renderPdf returns the compiled PDF as a Blob. The export modal uses
// URL.createObjectURL() to display it in an <iframe>. 503 from the server
// means Tectonic isn't configured — the modal falls back to the .tex view.
export async function renderPdf(id: string): Promise<Blob> {
  const token = getToken();
  const url = `${apiBaseUrl()}${ROOT}/${id}/render/pdf`;
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!res.ok) {
    let code = "render_failed";
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) code = body.error;
      if (body?.message) message = body.message;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) message = text;
    }
    throw new ApiError(res.status, code, message);
  }
  return res.blob();
}

export async function saveToVault(
  id: string,
  slot: number,
  label?: string
): Promise<ApiFile> {
  return api.post<ApiFile>(`${ROOT}/${id}/save-to-vault`, { slot, label });
}
