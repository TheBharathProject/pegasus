"use client";

import { FileIcon } from "@/components/icons";

// PendingReportLoader — full-page loader shown on /resume?id=<id>
// while the async AI generation is in flight. The page polls every 10s
// and flips to the full report once the JSON body lands; if the user
// navigates away, a notification fires when generation completes.
//
// Visual: a document icon centred inside an animated ring (CSS
// keyframe rotation with a small gap so the eye reads it as
// "spinning"). Calm, lots of whitespace, two lines of copy.

export function PendingReportLoader() {
  return (
    <section className="rs-pending-loader">
      <div className="rs-pending-ring">
        <FileIcon width={24} height={24} />
      </div>
      <h2 className="rs-pending-title">Analyzing your resume</h2>
      <p className="rs-pending-sub muted">
        Our AI is reviewing every section. This usually takes 10–15 seconds.
      </p>
    </section>
  );
}
