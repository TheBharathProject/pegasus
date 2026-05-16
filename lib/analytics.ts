// Pegasus client-side analytics wrapper.
//
// Every event in the app goes through `track()` and matches one of the
// AnalyticsEvent union members. Renaming an event becomes a TypeScript
// error, not a silent dashboard regression. New events get added here
// first; sprinkling unknown event names anywhere else is a type error.
//
// The transport is GA4's gtag.js, loaded by
// `<GoogleAnalytics gaId={…} />` (@next/third-parties) in
// app/layout.tsx. When the env var NEXT_PUBLIC_GA_ID is not set,
// gtag is never injected — `track()` then short-circuits to a no-op
// so local dev stays silent.

export type AnalyticsEvent =
  | { name: "login_succeeded"; params: { method: "google" | "email" } }
  | {
      name: "draft_created";
      params: {
        source: "sample" | "profile" | "upload" | "blank";
        template_id?: string;
      };
    }
  | {
      name: "draft_compiled";
      params: { draft_id: string; template_id?: string };
    }
  | { name: "draft_exported_pdf"; params: { draft_id: string } }
  | {
      name: "draft_saved_to_vault";
      params: { draft_id: string; slot: number };
    }
  | { name: "template_changed"; params: { template_id: string } }
  | { name: "font_changed"; params: { font_id: string } }
  | {
      name: "resume_score_requested";
      params: { source: "draft" | "file" | "text" };
    }
  | { name: "resume_parsed"; params: { source: "file" | "text" } }
  | { name: "ai_credit_blocked"; params: { feature: string } };

declare global {
  interface Window {
    gtag?: (cmd: string, ...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function track<E extends AnalyticsEvent>(event: E): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }
  window.gtag("event", event.name, event.params);
}
