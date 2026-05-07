import Link from "next/link";
import { MarketingFrame } from "@/components/frames";
import {
  ArrowRightIcon,
  ChatIcon,
  ContactIcon,
  FileIcon,
  HelpIcon,
  UserPlusIcon
} from "@/components/icons";

const communitySections = [
  {
    href: "/community/reviews",
    eyebrow: "01 · Reviews",
    title: "Resume Reviews",
    body: "Post your resume, collect peer feedback, and sort by newest, most reviewed, or least reviewed.",
    Icon: FileIcon
  },
  {
    href: "/community/experiences",
    eyebrow: "02 · Experiences",
    title: "Interview Experiences",
    body: "Real hiring loops with outcomes, round counts, difficulty, and locations — written by people who lived through them.",
    Icon: ChatIcon
  },
  {
    href: "/community/referrals",
    eyebrow: "03 · Referrals",
    title: "Referrals",
    body: "Offer a referral at your company, or browse what the community is opening up. Roles, locations, deadlines, requirements.",
    Icon: UserPlusIcon
  },
  {
    href: "/community/ask",
    eyebrow: "04 · Ask",
    title: "Ask the Community",
    body: "Career questions with tags for salary, negotiation, interview prep, and the work-life decisions nobody else is honest about.",
    Icon: HelpIcon
  },
  {
    href: "/community/recruiters",
    eyebrow: "05 · Recruiters",
    title: "Recruiter Directory",
    body: "A community-built map of recruiter names, companies, specializations, and shared context — so the messages you get aren't a black box.",
    Icon: ContactIcon
  }
];

export default function CommunityIndexPage() {
  return (
    <MarketingFrame current="community">
      <main className="section shell community-hub">
        <header className="community-hub-head">
          <p className="journal-eyebrow">The Pegasus Community</p>
          <h1 className="community-hub-title">Shared context for the job search.</h1>
          <p className="community-hub-dek">
            Five public surfaces where job seekers compare notes — quietly, in long form,
            without the algorithm sorting for outrage.
          </p>
        </header>

        <ul className="community-hub-list" aria-label="Community sections">
          {communitySections.map(({ href, eyebrow, title, body, Icon }) => (
            <li key={href}>
              <Link className="community-hub-row" href={href}>
                <span className="community-hub-icon">
                  <Icon width={18} height={18} />
                </span>
                <div className="community-hub-row-body">
                  <p className="community-hub-row-eyebrow">{eyebrow}</p>
                  <h2 className="community-hub-row-title">{title}</h2>
                  <p className="community-hub-row-dek">{body}</p>
                </div>
                <span className="community-hub-row-cta" aria-hidden>
                  <ArrowRightIcon width={16} height={16} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </MarketingFrame>
  );
}
