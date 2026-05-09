"use client";

// Thin redirector: lets links of the form /pegasus/applications/<id>
// land on the existing list page with the viewing modal opened for
// that row, without a separate detail page. Pattern is documented in
// ADR-0005 — the list page reads ?view=<id> on mount and calls openView()
// against the matching application once items load.
//
// This file deliberately renders nothing — it only flips the URL, then
// `app/applications/page.tsx` does the heavy lifting.

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ApplicationRedirector() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (!params?.id) return;
    router.replace(`/applications?view=${encodeURIComponent(params.id)}`);
  }, [params?.id, router]);

  return null;
}
