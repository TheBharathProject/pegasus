import Link from "next/link";
import { MarketingFrame } from "@/components/frames";

const communitySections = [
  {
    href: "/community/reviews",
    title: "Resume Reviews",
    body: "Post your resume, collect peer feedback, and sort by newest, most reviewed, or least reviewed."
  },
  {
    href: "/community/experiences",
    title: "Interview Experiences",
    body: "Share outcomes, round counts, difficulty, and locations in a feed optimized for hiring process memory."
  },
  {
    href: "/community/referrals",
    title: "Referrals",
    body: "A dedicated referral surface exists in the live route map even though the current public feed is still quiet."
  },
  {
    href: "/community/ask",
    title: "Ask",
    body: "A Q&A section with tag filters for salary, negotiation, interview prep, resume advice, and more."
  }
];

export default function CommunityIndexPage() {
  return (
    <MarketingFrame current="community">
      <main className="section shell">
        <div className="section-heading">
          <p className="eyebrow">Community</p>
          <h1>Shared context for the job search</h1>
          <p className="section-copy">
            The live site exposes four public community surfaces. This clone recreates each section
            with the observed filters and information architecture.
          </p>
        </div>
        <div className="card-grid columns-2">
          {communitySections.map((section) => (
            <Link className="community-card" href={section.href} key={section.href}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </Link>
          ))}
        </div>
      </main>
    </MarketingFrame>
  );
}
