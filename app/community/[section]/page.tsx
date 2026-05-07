import { notFound } from "next/navigation";
import { ProductFrame, CommunityTabs } from "@/components/frames";
import { communityExperiences, askTags } from "@/lib/site-data";

const sectionMeta = {
  reviews: {
    title: "Resume Reviews",
    intro: "Upload a resume for critique and filter the feed by role and seniority.",
    filters: ["Newest", "Least Reviewed", "Most Reviewed", "All Roles", "All Levels"]
  },
  experiences: {
    title: "Interview Experiences",
    intro: "Real hiring loops with outcomes, round counts, location context, and community voting.",
    filters: ["Newest", "Most Upvoted", "Offer", "Rejected", "Remote", "Onsite"]
  },
  referrals: {
    title: "Referrals",
    intro: "A dedicated route for referral requests and profile checks. The public feed is currently empty.",
    filters: ["Newest", "All Companies", "All Roles"]
  },
  ask: {
    title: "Ask",
    intro: "Career questions with tags for salary, negotiation, interview prep, and work-life decisions.",
    filters: ["Newest", "Most Upvoted", "Most Answered", "Unanswered"]
  },
  recruiters: {
    title: "Recruiters",
    intro: "A community directory for recruiter names, companies, reports, and shared context.",
    filters: ["Newest", "Company", "Reported", "All Roles"]
  }
} as const;

export function generateStaticParams() {
  return Object.keys(sectionMeta).map((section) => ({ section }));
}

export default function CommunitySectionPage({ params }: { params: { section: string } }) {
  const section = params.section as keyof typeof sectionMeta;
  const meta = sectionMeta[section];

  if (!meta) {
    notFound();
  }

  return (
    <ProductFrame
      active="community"
      title={meta.title}
      intro={meta.intro}
      kicker="Community"
      currentPath={`/community/${section}`}
    >
      <CommunityTabs current={`/community/${section}`} />
      <div className="filters">
        {meta.filters.map((filter) => (
          <div className="filter-box" key={filter}>
            {filter}
          </div>
        ))}
      </div>

      {section === "experiences" ? (
        <div className="stack" style={{ marginTop: 24 }}>
          {communityExperiences.map((experience) => (
            <article className="experience-row" key={experience.id}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span
                  aria-hidden
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "#2c2c2c",
                    color: "#ececea",
                    fontFamily: "var(--font-serif-stack)",
                    fontSize: 16
                  }}
                >
                  {experience.company.charAt(0)}
                </span>
                <div>
                  <strong>
                    {experience.company} · {experience.role}
                  </strong>
                  <div className="data-title">
                    {experience.author} · {experience.location} · {experience.roundCount} rounds
                  </div>
                </div>
              </div>
              <div className="pill-row" style={{ marginTop: 0 }}>
                <span className="pill">{experience.difficulty}</span>
                <span
                  className={
                    experience.outcome.toLowerCase() === "offer"
                      ? "pill tone-stage-offer"
                      : "pill"
                  }
                >
                  {experience.outcome}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {section === "ask" ? (
        <section className="panel" style={{ marginTop: 24 }}>
          <div className="list-head">
            <div>
              <h2>0 questions</h2>
              <p className="muted">The tag taxonomy already exists even though the board is empty.</p>
            </div>
            <div className="header-actions">
              <span className="primary-button">Ask</span>
            </div>
          </div>
          <div className="tag-row">
            {askTags.map((tag) => (
              <span className="pill" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {section === "reviews" || section === "referrals" || section === "recruiters" ? (
        <section className="panel" style={{ marginTop: 24 }}>
          <h2>No {section} yet</h2>
          <p className="muted" style={{ marginTop: 12 }}>
            The live product already has the surface, filters, create flows, and backend routes.
            This clone keeps the UX shell ready for real data.
          </p>
        </section>
      ) : null}
    </ProductFrame>
  );
}
