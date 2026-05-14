"use client";

import type {
  ApiArchetype,
  ApiCoreDiagnosis,
  ApiIdentityMatch
} from "@/lib/api-client";

// CoreDiagnosis — the diagnosis-first block from the resume-analyzer
// skill. Rendered at the very top of the Results step, ABOVE the
// verdict pill and score row. The user reads this first; everything
// else flows from it.

function archetypeLabel(a: ApiArchetype | undefined): string {
  switch (a) {
    case "identity_crisis":
      return "Identity Crisis";
    case "underseller":
      return "Underseller";
    case "overseller":
      return "Overseller";
    case "list_of_jobs":
      return "List of Jobs";
    case "duty_lister":
      return "Duty Lister";
    case "career_changer":
      return "Career Changer";
    case "long_in_the_tooth":
      return "Long in the Tooth";
    case "junior_looking_senior":
      return "Junior Looking Senior";
    case "senior_looking_junior":
      return "Senior Looking Junior";
    case "tool_lister":
      return "Tool Lister";
    default:
      return "";
  }
}

function identityLabel(m: ApiIdentityMatch): string {
  switch (m) {
    case "match":
      return "Identity match";
    case "mismatch":
      return "Identity mismatch";
    case "unclear":
      return "Identity unclear";
  }
}

export function CoreDiagnosis({ diagnosis }: { diagnosis: ApiCoreDiagnosis }) {
  const arch = archetypeLabel(diagnosis.archetype);
  return (
    <section className="rs-core-diagnosis">
      <header className="rs-core-diagnosis-head">
        <p className="rs-core-diagnosis-eyebrow">Core Diagnosis</p>
        <h2>{diagnosis.core_problem}</h2>
      </header>

      <div className="rs-core-diagnosis-row">
        <div className="rs-core-diagnosis-cell">
          <p className="rs-core-diagnosis-label">6-second verdict</p>
          <p className="rs-core-diagnosis-value">
            {diagnosis.six_second_verdict || "—"}
          </p>
        </div>
        <div className="rs-core-diagnosis-cell">
          <p className="rs-core-diagnosis-label">
            {identityLabel(diagnosis.identity_match)}
          </p>
          <p
            className={`rs-core-diagnosis-value rs-identity-${diagnosis.identity_match}`}
          >
            {diagnosis.identity_match === "match"
              ? "Resume signals the role the candidate appears to target."
              : diagnosis.identity_match === "mismatch"
                ? "Resume signals a different role than the candidate's target — biggest fix opportunity."
                : "Recruiter can't tell what this candidate is FOR in 6 seconds."}
          </p>
        </div>
        {arch ? (
          <div className="rs-core-diagnosis-cell">
            <p className="rs-core-diagnosis-label">Archetype</p>
            <p className="rs-core-diagnosis-value">
              <span className="rs-archetype-pill">{arch}</span>
            </p>
          </div>
        ) : null}
      </div>

      {diagnosis.hidden_story ? (
        <div className="rs-hidden-story">
          <p className="rs-core-diagnosis-label">The hidden story</p>
          <p className="rs-hidden-story-text">{diagnosis.hidden_story}</p>
        </div>
      ) : null}
    </section>
  );
}
