"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { ProductFrame, CommunityTabs } from "@/components/frames";
import {
  ChatIcon,
  CloseIcon,
  ContactIcon,
  FileIcon,
  HelpIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
  UserPlusIcon
} from "@/components/icons";
import { askTags, communityExperiences } from "@/lib/site-data";
import {
  buildAskPayload,
  buildExperiencePayload,
  buildRecruiterPayload,
  buildReferralPayload,
  buildReviewPayload,
  createCommunityPost,
  listCommunityPosts,
  type CommunitySurface
} from "@/lib/community";
import type { ApiCommunityPost } from "@/lib/api-client";

type SectionKey = "reviews" | "experiences" | "referrals" | "ask" | "recruiters";

const sectionMeta: Record<SectionKey, {
  title: string;
  intro: string;
  countNoun: string;
  primaryLabel: string;
  filters: string[];
  searchPlaceholder?: string;
  emptyTitle: string;
  emptyBody: string;
  emptyCta: string;
}> = {
  reviews: {
    title: "Resume Reviews",
    intro: "Upload a resume for critique and filter the feed by role and seniority.",
    countNoun: "reviews",
    primaryLabel: "Post your resume",
    filters: ["Newest", "All Roles", "All Levels"],
    searchPlaceholder: "Search reviews…",
    emptyTitle: "No reviews yet",
    emptyBody: "Be the first to post your resume for review. Get feedback from the community.",
    emptyCta: "Post your resume"
  },
  experiences: {
    title: "Interview Experiences",
    intro: "Real hiring loops with outcomes, round counts, location context, and community voting.",
    countNoun: "experiences shared by the community",
    primaryLabel: "Share",
    filters: ["Newest", "All Outcomes"],
    searchPlaceholder: "Search company or role…",
    emptyTitle: "No experiences yet",
    emptyBody: "Share an interview loop you've been through to help others know what to expect.",
    emptyCta: "Share an experience"
  },
  referrals: {
    title: "Referrals",
    intro: "A dedicated route for referral requests and profile checks.",
    countNoun: "open referrals",
    primaryLabel: "Offer Referral",
    filters: ["Newest", "All Companies", "All Roles"],
    searchPlaceholder: "Search company or role…",
    emptyTitle: "No referrals yet.",
    emptyBody: "Have a role you can refer for? Post it here so the community can apply.",
    emptyCta: "Offer the first one"
  },
  ask: {
    title: "Ask",
    intro: "Career questions with tags for salary, negotiation, interview prep, and work-life decisions.",
    countNoun: "questions",
    primaryLabel: "Ask",
    filters: ["Newest", "All Tags"],
    searchPlaceholder: "Search questions…",
    emptyTitle: "No questions yet.",
    emptyBody: "Ask anything about job hunting, negotiation, interviews — the community will weigh in.",
    emptyCta: "Ask the first one"
  },
  recruiters: {
    title: "Recruiter Directory",
    intro: "A community directory for recruiter names, companies, and shared context.",
    countNoun: "recruiters contributed by the community",
    primaryLabel: "Add Recruiter",
    filters: ["Most Upvoted", "All Companies"],
    searchPlaceholder: "Search name or company…",
    emptyTitle: "No recruiters listed yet",
    emptyBody: "Add a recruiter you've worked with to help others map the hiring landscape.",
    emptyCta: "Add Recruiter"
  }
};

const seedRecruiters = [
  { recruiter: "Kriti Mahajan", title: "HR", company: "Clear", reviews: 0, upvotes: 1 },
  { recruiter: "Swarnak", title: "—", company: "Microsoft", reviews: 0, upvotes: 1 },
  { recruiter: "Siddhant Rawat", title: "HR", company: "Nagarro", reviews: 0, upvotes: 1 },
  { recruiter: "Ankit Khare", title: "Talent Acquisition Strategist", company: "Trademo", reviews: 1, upvotes: 1 },
  { recruiter: "Parul Pal", title: "—", company: "Stanza Living", reviews: 0, upvotes: 0 },
  { recruiter: "Vishwakrma", title: "—", company: "Policybazaar.com", reviews: 0, upvotes: 0 },
  { recruiter: "Garima Rai", title: "—", company: "Gartner", reviews: 0, upvotes: 0 },
  { recruiter: "Roshan", title: "—", company: "Apollo.io", reviews: 0, upvotes: 0 },
  { recruiter: "Yugal", title: "—", company: "PW (PhysicsWallah)", reviews: 0, upvotes: 0 },
  { recruiter: "Tulsi Jha", title: "—", company: "GeeksforGeeks", reviews: 0, upvotes: 0 }
];

const ROUND_TYPES = [
  "Phone Screen",
  "Recruiter Call",
  "Technical",
  "Coding",
  "System Design",
  "Behavioral",
  "Onsite",
  "Hiring Manager",
  "HR",
  "Other"
];
const OUTCOMES = ["Offer", "Rejected", "In Progress", "Withdrew", "Ghosted"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const TARGET_ROLES = [
  "Frontend Engineer",
  "Backend Engineer",
  "Full-Stack Engineer",
  "Mobile Engineer",
  "Data Engineer",
  "ML Engineer",
  "DevOps / Platform",
  "Product Manager",
  "Designer",
  "Other"
];
const EXPERIENCE_LEVELS = ["Intern", "Entry Level", "Mid Level", "Senior", "Staff+", "Manager"];
const SPECIALIZATIONS = [
  "Backend",
  "Frontend",
  "Full Stack",
  "Data",
  "Mobile",
  "DevOps",
  "ML/AI",
  "Product",
  "Design",
  "Security",
  "QA",
  "Other"
];
const HIRING_LEVELS = [
  "Intern",
  "Entry Level",
  "Mid Level",
  "Senior",
  "Staff",
  "Principal",
  "Director",
  "VP"
];

function EmptyStateIcon({ section }: { section: SectionKey }) {
  switch (section) {
    case "reviews":
      return <FileIcon width={22} height={22} />;
    case "experiences":
      return <ChatIcon width={22} height={22} />;
    case "referrals":
      return <UserPlusIcon width={22} height={22} />;
    case "ask":
      return <HelpIcon width={22} height={22} />;
    case "recruiters":
      return <ContactIcon width={22} height={22} />;
  }
}

// ---- Drafts ---------------------------------------------------------------

type ReviewDraft = {
  uploadMode: "upload" | "vault";
  fileName: string;
  fileSizeKB: number;
  title: string;
  targetRole: string;
  level: string;
  feedback: string;
};

type Round = { id: number; type: string; questions: string; tips: string };

type ExperienceDraft = {
  linkedApplication: string;
  company: string;
  role: string;
  yearsOfExperience: string;
  location: string;
  outcome: string;
  difficulty: string;
  rounds: Round[];
  shareSalary: boolean;
  overallTips: string;
};

type ReferralDraft = {
  company: string;
  roles: string[];
  locations: string[];
  count: string;
  deadline: string;
  notes: string;
};

type AskDraft = { question: string; details: string; tags: string[]; tagInput: string };

type RecruiterDraft = {
  recruiter: string;
  company: string;
  title: string;
  linkedinUrl: string;
  email: string;
  specializations: string[];
  hiringLevels: string[];
};

const emptyReview: ReviewDraft = {
  uploadMode: "upload",
  fileName: "",
  fileSizeKB: 0,
  title: "",
  targetRole: "",
  level: "",
  feedback: ""
};
const emptyExperience: ExperienceDraft = {
  linkedApplication: "",
  company: "",
  role: "",
  yearsOfExperience: "",
  location: "",
  outcome: "",
  difficulty: "",
  rounds: [{ id: 1, type: "Phone Screen", questions: "", tips: "" }],
  shareSalary: false,
  overallTips: ""
};
const emptyReferral: ReferralDraft = {
  company: "",
  roles: [""],
  locations: [""],
  count: "1",
  deadline: "",
  notes: ""
};
const emptyAsk: AskDraft = { question: "", details: "", tags: [], tagInput: "" };
const emptyRecruiter: RecruiterDraft = {
  recruiter: "",
  company: "",
  title: "",
  linkedinUrl: "",
  email: "",
  specializations: [],
  hiringLevels: []
};

// validSurface narrows a route param to the discriminated union the API
// expects. The notFound() call below catches strays before they reach
// the listCommunityPosts call, but having this helper at the top means
// useEffect can short-circuit cleanly without a TS cast.
function validSurface(s: string): s is CommunitySurface {
  return (
    s === "reviews" ||
    s === "experiences" ||
    s === "referrals" ||
    s === "ask" ||
    s === "recruiters"
  );
}

// Client-side search across title + body. The community list is paged
// at 20 posts so substring search is fine; once we cross a few hundred
// per surface this should move server-side.
function filteredPosts(posts: ApiCommunityPost[], q: string): ApiCommunityPost[] {
  const trimmed = q.trim().toLowerCase();
  if (!trimmed) return posts;
  return posts.filter(
    (p) =>
      p.title.toLowerCase().includes(trimmed) ||
      (p.body ?? "").toLowerCase().includes(trimmed)
  );
}

// Same shape as the timeline + notification pages — short-form relative
// time. Older items fall back to a date.
function fmtRelative(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ---- Page ----------------------------------------------------------------

export default function CommunitySectionPage() {
  const params = useParams<{ section: string }>();
  const section = (params?.section ?? "") as SectionKey;
  const meta = sectionMeta[section];
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>(emptyReview);
  const [experienceDraft, setExperienceDraft] = useState<ExperienceDraft>(emptyExperience);
  const [referralDraft, setReferralDraft] = useState<ReferralDraft>(emptyReferral);
  const [askDraft, setAskDraft] = useState<AskDraft>(emptyAsk);
  const [recruiterDraft, setRecruiterDraft] = useState<RecruiterDraft>(emptyRecruiter);

  // Fetched community posts for THIS surface. Populated on mount + after
  // every successful create. Empty array == not loaded yet OR genuinely
  // empty surface; we use loadedOnce to disambiguate for the empty state.
  const [posts, setPosts] = useState<ApiCommunityPost[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Fetch posts whenever the surface changes (e.g. nav between
  // /community/ask and /community/experiences without a full reload).
  useEffect(() => {
    if (!validSurface(section)) return;
    let cancelled = false;
    setLoadedOnce(false);
    listCommunityPosts(section as CommunitySurface, { limit: 20 })
      .then((res) => {
        if (cancelled) return;
        setPosts(res.items);
      })
      .catch(() => {
        if (cancelled) return;
        setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadedOnce(true);
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  const refreshPosts = async () => {
    if (!validSurface(section)) return;
    try {
      const res = await listCommunityPosts(section as CommunitySurface, { limit: 20 });
      setPosts(res.items);
    } catch {
      // Keep prior list; toast already showed success.
    }
  };

  if (!meta) {
    notFound();
  }

  const count =
    section === "experiences"
      ? communityExperiences.length
      : section === "recruiters"
        ? seedRecruiters.length
        : 0;

  const filteredRecruiters = seedRecruiters.filter(
    (r) =>
      !search.trim() ||
      r.recruiter.toLowerCase().includes(search.toLowerCase()) ||
      r.company.toLowerCase().includes(search.toLowerCase())
  );

  const filteredExperiences = communityExperiences.filter(
    (e) =>
      !search.trim() ||
      e.company.toLowerCase().includes(search.toLowerCase()) ||
      e.role.toLowerCase().includes(search.toLowerCase())
  );

  const closeModal = () => setOpenModal(false);

  // Reset all drafts back to their empty state. Called after a successful
  // post creation so the modal reopens clean next time.
  const resetDrafts = () => {
    setReviewDraft(emptyReview);
    setExperienceDraft({
      ...emptyExperience,
      rounds: [{ id: 1, type: "Phone Screen", questions: "", tips: "" }]
    });
    setReferralDraft(emptyReferral);
    setAskDraft(emptyAsk);
    setRecruiterDraft(emptyRecruiter);
  };

  // submit dispatches to the right surface-specific payload builder, POSTs,
  // shows a success toast, refetches the list. On error we keep the modal
  // open so the user can edit and retry — matches the existing UX pattern
  // in other modals across the app.
  const submit = async (
    builder: () => { title: string; body?: string; metadata: Record<string, unknown>; isPublic: boolean },
    successMessage: string
  ) => {
    if (submitting || !validSurface(section)) return;
    setSubmitting(true);
    try {
      const payload = builder();
      await createCommunityPost(section as CommunitySurface, payload);
      setOpenModal(false);
      resetDrafts();
      setToast(successMessage);
      void refreshPosts();
    } catch (e) {
      window.alert(`Could not post: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProductFrame
      active="community"
      title={meta.title}
      intro={`${count > 0 ? count + " " : ""}${meta.countNoun}`}
      currentPath={`/community/${section}`}
      actions={
        <button type="button" className="primary-button" onClick={() => setOpenModal(true)}>
          <PlusIcon width={14} height={14} /> {meta.primaryLabel}
        </button>
      }
    >
      <CommunityTabs current={`/community/${section}`} />

      {meta.searchPlaceholder ? (
        <div className="community-search">
          <span className="community-search-icon">
            <SearchIcon width={14} height={14} />
          </span>
          <input
            type="text"
            placeholder={meta.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      ) : null}

      <div className="filters">
        {meta.filters.map((filter) => (
          <button type="button" className="filter-box" key={filter}>
            {filter}
          </button>
        ))}
      </div>

      {section === "ask" ? (
        <div className="tag-row">
          {askTags.map((tag) => (
            <span className="pill" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {/* Real posts fetched from /community/{surface}. Until 3b lands in
          prod the list will be empty, in which case we show the
          surface-specific empty state (CommunityEmpty). */}
      {!loadedOnce ? (
        <p className="muted small" style={{ marginTop: 24 }}>Loading…</p>
      ) : filteredPosts(posts, search).length > 0 ? (
        <ul className="post-list">
          {filteredPosts(posts, search).map((post) => (
            <li key={post.id}>
              <Link className="post-row" href={`/community/posts/${post.slug || post.id}`}>
                <div className="post-row-body">
                  <h3 className="post-row-title">{post.title}</h3>
                  {post.body ? (
                    <p className="post-row-preview">
                      {post.body.length > 200 ? post.body.slice(0, 200) + "…" : post.body}
                    </p>
                  ) : null}
                  <p className="post-row-meta">
                    <span>{post.authorName || "Anonymous"}</span>
                    <span aria-hidden>·</span>
                    <span>{fmtRelative(post.createdAt)}</span>
                    <span aria-hidden>·</span>
                    <span>↑ {post.voteCount}</span>
                    <span aria-hidden>·</span>
                    <span>{post.commentCount} {post.commentCount === 1 ? "reply" : "replies"}</span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <CommunityEmpty section={section} meta={meta} onCta={() => setOpenModal(true)} />
      )}

      {/* ---- Modals ---- */}
      {openModal && section === "reviews" ? (
        <ReviewModal
          draft={reviewDraft}
          setDraft={setReviewDraft}
          onClose={closeModal}
          onSubmit={() => submit(() => buildReviewPayload(reviewDraft), "Resume submitted for review")}
        />
      ) : null}

      {openModal && section === "experiences" ? (
        <ExperienceModal
          draft={experienceDraft}
          setDraft={setExperienceDraft}
          onClose={closeModal}
          onSubmit={() => submit(() => buildExperiencePayload(experienceDraft), "Experience published")}
        />
      ) : null}

      {openModal && section === "referrals" ? (
        <ReferralModal
          draft={referralDraft}
          setDraft={setReferralDraft}
          onClose={closeModal}
          onSubmit={() => submit(() => buildReferralPayload(referralDraft), "Referral posted")}
        />
      ) : null}

      {openModal && section === "ask" ? (
        <AskModal
          draft={askDraft}
          setDraft={setAskDraft}
          onClose={closeModal}
          onSubmit={() => submit(() => buildAskPayload(askDraft), "Question posted")}
        />
      ) : null}

      {openModal && section === "recruiters" ? (
        <RecruiterModal
          draft={recruiterDraft}
          setDraft={setRecruiterDraft}
          onClose={closeModal}
          onSubmit={() => submit(() => buildRecruiterPayload(recruiterDraft), "Recruiter added")}
        />
      ) : null}

      {toast ? <div className="community-toast" role="status">{toast}</div> : null}
    </ProductFrame>
  );
}

function CommunityEmpty({
  section,
  meta,
  onCta
}: {
  section: SectionKey;
  meta: (typeof sectionMeta)[SectionKey];
  onCta: () => void;
}) {
  return (
    <div className="community-empty">
      <span className="community-empty-icon">
        <EmptyStateIcon section={section} />
      </span>
      <h3>{meta.emptyTitle}</h3>
      <p>{meta.emptyBody}</p>
      <button type="button" className="primary-button" onClick={onCta}>
        <PlusIcon width={14} height={14} /> {meta.emptyCta}
      </button>
    </div>
  );
}

// ---- Modal shell + actions -----------------------------------------------

function ModalShell({
  title,
  intro,
  size,
  children,
  onClose
}: {
  title: string;
  intro?: string;
  size?: "default" | "lg";
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={size === "lg" ? "modal-card modal-card--lg" : "modal-card"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="list-head">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose} type="button">
            <CloseIcon width={14} height={14} />
          </button>
        </div>
        {intro ? <p className="modal-intro">{intro}</p> : null}
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  onSubmit,
  disabled,
  submitLabel
}: {
  onCancel: () => void;
  onSubmit: () => void;
  disabled: boolean;
  submitLabel: string;
}) {
  return (
    <div className="section-actions" style={{ justifyContent: "flex-end", marginTop: 22 }}>
      <button className="ghost-button" onClick={onCancel} type="button">
        Cancel
      </button>
      <button className="primary-button" onClick={onSubmit} disabled={disabled} type="button">
        {submitLabel}
      </button>
    </div>
  );
}

// ---- Reviews ---------------------------------------------------------------

function ReviewModal({
  draft,
  setDraft,
  onClose,
  onSubmit
}: {
  draft: ReviewDraft;
  setDraft: (d: ReviewDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setDraft({ ...draft, fileName: f.name, fileSizeKB: Math.round(f.size / 1024) });
  };
  const valid = !!draft.fileName && !!draft.title.trim();

  return (
    <ModalShell
      title="Post Resume for Review"
      intro="Upload a screenshot or select from your vault to get structured feedback."
      onClose={onClose}
    >
      <div className="form-grid">
        <div className="field wide">
          <label>Resume</label>
          <div className="upload-tabs">
            <button
              type="button"
              className={draft.uploadMode === "upload" ? "is-active" : ""}
              onClick={() => setDraft({ ...draft, uploadMode: "upload" })}
            >
              <UploadIcon width={12} height={12} /> Upload Image
            </button>
            <button
              type="button"
              className={draft.uploadMode === "vault" ? "is-active" : ""}
              onClick={() => setDraft({ ...draft, uploadMode: "vault" })}
            >
              <FileIcon width={12} height={12} /> From Vault (PDF)
            </button>
          </div>
          <div
            className={draft.fileName ? "upload-tile is-filled" : "upload-tile"}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") fileRef.current?.click();
            }}
          >
            <span className="upload-tile-icon">
              <UploadIcon width={20} height={20} />
            </span>
            {draft.fileName ? (
              <>
                <span className="upload-tile-title">{draft.fileName}</span>
                <span className="upload-tile-meta">{draft.fileSizeKB} KB · click to replace</span>
              </>
            ) : draft.uploadMode === "upload" ? (
              <>
                <span className="upload-tile-title">Click to upload a screenshot</span>
                <span className="upload-tile-meta">
                  PNG, JPG, or WebP · max 5MB · crop out personal details before uploading
                </span>
              </>
            ) : (
              <>
                <span className="upload-tile-title">Pick a resume from your vault</span>
                <span className="upload-tile-meta">PDF · pulled from your existing vault slots</span>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={draft.uploadMode === "upload" ? "image/*" : "application/pdf"}
              hidden
              onChange={onPick}
            />
          </div>
        </div>

        <div className="field wide">
          <label>Title *</label>
          <input
            placeholder='e.g. "SDE resume, 2 YOE, targeting product companies"'
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Target Role</label>
          <select
            value={draft.targetRole}
            onChange={(e) => setDraft({ ...draft, targetRole: e.target.value })}
          >
            <option value="">Select a role…</option>
            {TARGET_ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Experience Level</label>
          <select
            value={draft.level}
            onChange={(e) => setDraft({ ...draft, level: e.target.value })}
          >
            <option value="">Select level…</option>
            {EXPERIENCE_LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <div className="field wide">
          <label>What feedback are you looking for?</label>
          <textarea
            placeholder="e.g. I'm getting very low response rates. Is my projects section too weak? Should I change the format?"
            value={draft.feedback}
            onChange={(e) => setDraft({ ...draft, feedback: e.target.value })}
          />
        </div>
      </div>

      <ModalActions
        onCancel={onClose}
        onSubmit={onSubmit}
        disabled={!valid}
        submitLabel="Post for Review"
      />
    </ModalShell>
  );
}

// ---- Experiences ---------------------------------------------------------

function ExperienceModal({
  draft,
  setDraft,
  onClose,
  onSubmit
}: {
  draft: ExperienceDraft;
  setDraft: (d: ExperienceDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const updateRound = (id: number, patch: Partial<Round>) => {
    setDraft({
      ...draft,
      rounds: draft.rounds.map((r) => (r.id === id ? { ...r, ...patch } : r))
    });
  };
  const addRound = () => {
    const nextId = (draft.rounds[draft.rounds.length - 1]?.id ?? 0) + 1;
    setDraft({
      ...draft,
      rounds: [...draft.rounds, { id: nextId, type: "Technical", questions: "", tips: "" }]
    });
  };
  const removeRound = (id: number) => {
    if (draft.rounds.length <= 1) return;
    setDraft({ ...draft, rounds: draft.rounds.filter((r) => r.id !== id) });
  };

  const minQuestions = 20;
  const valid =
    !!draft.company.trim() &&
    !!draft.role.trim() &&
    !!draft.outcome &&
    draft.rounds.every((r) => r.questions.trim().length >= minQuestions);

  return (
    <ModalShell
      title="Share Interview Experience"
      intro="Help others by sharing what the interview process was really like."
      size="lg"
      onClose={onClose}
    >
      <div className="form-grid">
        <div className="field wide">
          <label>Link to tracked application (optional)</label>
          <select
            value={draft.linkedApplication}
            onChange={(e) => setDraft({ ...draft, linkedApplication: e.target.value })}
          >
            <option value="">None — enter manually</option>
          </select>
        </div>
        <div className="field">
          <label>Company *</label>
          <input
            placeholder="Google"
            value={draft.company}
            onChange={(e) => setDraft({ ...draft, company: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Role *</label>
          <input
            placeholder="SDE-2"
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Years of Experience</label>
          <input
            type="number"
            min={0}
            placeholder="3"
            value={draft.yearsOfExperience}
            onChange={(e) => setDraft({ ...draft, yearsOfExperience: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Location</label>
          <input
            placeholder="Bangalore"
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Outcome *</label>
          <select
            value={draft.outcome}
            onChange={(e) => setDraft({ ...draft, outcome: e.target.value })}
          >
            <option value="">Select…</option>
            {OUTCOMES.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Difficulty</label>
          <select
            value={draft.difficulty}
            onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })}
          >
            <option value="">Select…</option>
            {DIFFICULTIES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="field wide">
          <label>Interview Rounds *</label>
          {draft.rounds.map((round, idx) => {
            const remaining = Math.max(0, minQuestions - round.questions.trim().length);
            return (
              <div className="round-card" key={round.id}>
                <div className="round-head">
                  <span className="round-head-left">Round {idx + 1}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      value={round.type}
                      onChange={(e) => updateRound(round.id, { type: e.target.value })}
                    >
                      {ROUND_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    {draft.rounds.length > 1 ? (
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Remove round ${idx + 1}`}
                        onClick={() => removeRound(round.id)}
                      >
                        <CloseIcon width={12} height={12} />
                      </button>
                    ) : null}
                  </div>
                </div>
                <textarea
                  placeholder="Questions / topics covered (min 20 characters)…"
                  value={round.questions}
                  onChange={(e) => updateRound(round.id, { questions: e.target.value })}
                />
                <span
                  className={remaining > 0 ? "field-help is-warn" : "field-help"}
                >
                  {round.questions.trim().length}/{minQuestions} min characters
                </span>
                <input
                  placeholder="Tips for this round (optional)"
                  value={round.tips}
                  onChange={(e) => updateRound(round.id, { tips: e.target.value })}
                />
              </div>
            );
          })}
          <button type="button" className="add-link" onClick={addRound}>
            <PlusIcon width={12} height={12} /> Add Round
          </button>
        </div>

        <div className="field wide">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.shareSalary}
              onChange={(e) => setDraft({ ...draft, shareSalary: e.target.checked })}
            />
            <span>Share salary details (displayed anonymously)</span>
          </label>
        </div>

        <div className="field wide">
          <label>Overall Tips / Advice</label>
          <textarea
            placeholder="General advice for someone interviewing at this company…"
            value={draft.overallTips}
            onChange={(e) => setDraft({ ...draft, overallTips: e.target.value })}
          />
        </div>
      </div>

      <ModalActions
        onCancel={onClose}
        onSubmit={onSubmit}
        disabled={!valid}
        submitLabel="Publish Experience"
      />
    </ModalShell>
  );
}

// ---- Referrals ----------------------------------------------------------

function ReferralModal({
  draft,
  setDraft,
  onClose,
  onSubmit
}: {
  draft: ReferralDraft;
  setDraft: (d: ReferralDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const updateAt = (key: "roles" | "locations", idx: number, value: string) => {
    setDraft({ ...draft, [key]: draft[key].map((v, i) => (i === idx ? value : v)) });
  };
  const removeAt = (key: "roles" | "locations", idx: number) => {
    if (draft[key].length <= 1) {
      // Last entry — just clear it instead of dropping below 1.
      setDraft({ ...draft, [key]: [""] });
      return;
    }
    setDraft({ ...draft, [key]: draft[key].filter((_, i) => i !== idx) });
  };
  const addOne = (key: "roles" | "locations") => {
    setDraft({ ...draft, [key]: [...draft[key], ""] });
  };

  const validRoles = draft.roles.some((r) => r.trim());
  const valid = !!draft.company.trim() && validRoles && !!draft.count.trim();

  return (
    <ModalShell
      title="Offer a Referral"
      intro="Help someone land a job at your company."
      onClose={onClose}
    >
      <div className="form-grid">
        <div className="field wide">
          <label>Company *</label>
          <input
            placeholder="Google"
            value={draft.company}
            onChange={(e) => setDraft({ ...draft, company: e.target.value })}
          />
        </div>

        <div className="field wide">
          <label>Roles *</label>
          {draft.roles.map((role, idx) => (
            <div className="repeat-row" key={`role-${idx}`}>
              <input
                placeholder={idx === 0 ? "SDE-1" : "Another role"}
                value={role}
                onChange={(e) => updateAt("roles", idx, e.target.value)}
              />
              <button
                className="icon-button"
                type="button"
                aria-label={`Remove role ${idx + 1}`}
                onClick={() => removeAt("roles", idx)}
              >
                <CloseIcon width={12} height={12} />
              </button>
            </div>
          ))}
          <button type="button" className="add-link" onClick={() => addOne("roles")}>
            <PlusIcon width={12} height={12} /> Add role
          </button>
        </div>

        <div className="field wide">
          <label>Locations (optional)</label>
          {draft.locations.map((loc, idx) => (
            <div className="repeat-row" key={`loc-${idx}`}>
              <input
                placeholder={idx === 0 ? "Bangalore" : "Another location"}
                value={loc}
                onChange={(e) => updateAt("locations", idx, e.target.value)}
              />
              <button
                className="icon-button"
                type="button"
                aria-label={`Remove location ${idx + 1}`}
                onClick={() => removeAt("locations", idx)}
              >
                <CloseIcon width={12} height={12} />
              </button>
            </div>
          ))}
          <button type="button" className="add-link" onClick={() => addOne("locations")}>
            <PlusIcon width={12} height={12} /> Add location
          </button>
        </div>

        <div className="field">
          <label>How many can you refer? *</label>
          <input
            type="number"
            min={1}
            placeholder="5"
            value={draft.count}
            onChange={(e) => setDraft({ ...draft, count: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Deadline (optional)</label>
          <input
            type="date"
            value={draft.deadline}
            onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
          />
        </div>
        <div className="field wide">
          <label>Requirements / Notes (optional)</label>
          <textarea
            placeholder="What are you looking for in candidates? YOE, tech stack, anything else…"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </div>
      </div>

      <ModalActions
        onCancel={onClose}
        onSubmit={onSubmit}
        disabled={!valid}
        submitLabel="Post Referral"
      />
    </ModalShell>
  );
}

// ---- Ask -----------------------------------------------------------------

function AskModal({
  draft,
  setDraft,
  onClose,
  onSubmit
}: {
  draft: AskDraft;
  setDraft: (d: AskDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const MAX_QUESTION = 300;
  const MIN_QUESTION = 10;
  const MAX_DETAILS = 5000;
  const MAX_TAGS = 3;

  const commitTag = () => {
    const next = draft.tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!next) return;
    if (draft.tags.includes(next)) {
      setDraft({ ...draft, tagInput: "" });
      return;
    }
    if (draft.tags.length >= MAX_TAGS) return;
    setDraft({ ...draft, tags: [...draft.tags, next], tagInput: "" });
  };
  const onTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitTag();
    } else if (e.key === "Backspace" && !draft.tagInput && draft.tags.length > 0) {
      setDraft({ ...draft, tags: draft.tags.slice(0, -1) });
    }
  };
  const removeTag = (t: string) =>
    setDraft({ ...draft, tags: draft.tags.filter((x) => x !== t) });

  const questionLen = draft.question.trim().length;
  const valid = questionLen >= MIN_QUESTION && questionLen <= MAX_QUESTION;

  return (
    <ModalShell title="Ask the Community" onClose={onClose}>
      <div className="form-grid">
        <div className="field wide">
          <label>Question *</label>
          <input
            placeholder="e.g. Should I join a startup at 18L or an MNC at 14L?"
            value={draft.question}
            maxLength={MAX_QUESTION}
            onChange={(e) => setDraft({ ...draft, question: e.target.value })}
          />
          <span
            className={
              questionLen > 0 && questionLen < MIN_QUESTION
                ? "field-help is-warn"
                : "field-help"
            }
          >
            {questionLen}/{MAX_QUESTION} · minimum {MIN_QUESTION} characters
          </span>
        </div>

        <div className="field wide">
          <label>Details (optional)</label>
          <textarea
            placeholder="Add context so the community can give you a better answer…"
            value={draft.details}
            maxLength={MAX_DETAILS}
            onChange={(e) => setDraft({ ...draft, details: e.target.value })}
          />
          <span className="field-help">
            {draft.details.length}/{MAX_DETAILS}
          </span>
        </div>

        <div className="field wide">
          <label>Tags (up to {MAX_TAGS})</label>
          <div className="tag-input-shell">
            {draft.tags.map((t) => (
              <span className="tag-chip" key={t}>
                #{t}
                <button
                  type="button"
                  aria-label={`Remove tag ${t}`}
                  onClick={() => removeTag(t)}
                >
                  <CloseIcon width={10} height={10} />
                </button>
              </span>
            ))}
            <input
              placeholder={
                draft.tags.length >= MAX_TAGS
                  ? `Max ${MAX_TAGS} tags`
                  : "Type a tag and press Enter…"
              }
              value={draft.tagInput}
              onChange={(e) => setDraft({ ...draft, tagInput: e.target.value })}
              onKeyDown={onTagKeyDown}
              onBlur={commitTag}
              disabled={draft.tags.length >= MAX_TAGS}
            />
          </div>
        </div>
      </div>

      <ModalActions
        onCancel={onClose}
        onSubmit={onSubmit}
        disabled={!valid}
        submitLabel="Post Question"
      />
    </ModalShell>
  );
}

// ---- Recruiter -----------------------------------------------------------

function RecruiterModal({
  draft,
  setDraft,
  onClose,
  onSubmit
}: {
  draft: RecruiterDraft;
  setDraft: (d: RecruiterDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const toggleSpec = (s: string) =>
    setDraft({
      ...draft,
      specializations: draft.specializations.includes(s)
        ? draft.specializations.filter((x) => x !== s)
        : [...draft.specializations, s]
    });
  const toggleLevel = (l: string) =>
    setDraft({
      ...draft,
      hiringLevels: draft.hiringLevels.includes(l)
        ? draft.hiringLevels.filter((x) => x !== l)
        : [...draft.hiringLevels, l]
    });

  const valid = !!draft.recruiter.trim() && !!draft.company.trim();

  return (
    <ModalShell title="Add a Recruiter" onClose={onClose}>
      <div className="form-grid">
        <div className="field wide">
          <label>Name *</label>
          <input
            placeholder="e.g. Priya Sharma"
            value={draft.recruiter}
            onChange={(e) => setDraft({ ...draft, recruiter: e.target.value })}
          />
        </div>
        <div className="field wide">
          <label>Company *</label>
          <input
            placeholder="e.g. Google"
            value={draft.company}
            onChange={(e) => setDraft({ ...draft, company: e.target.value })}
          />
        </div>
        <div className="field wide">
          <label>Title</label>
          <input
            placeholder="e.g. Senior Technical Recruiter"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </div>
        <div className="field wide">
          <label>LinkedIn URL</label>
          <input
            type="url"
            placeholder="https://linkedin.com/in/…"
            value={draft.linkedinUrl}
            onChange={(e) => setDraft({ ...draft, linkedinUrl: e.target.value })}
          />
        </div>
        <div className="field wide">
          <label>Email</label>
          <input
            type="email"
            placeholder="recruiter@company.com"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
        </div>

        <div className="field wide">
          <label>Specializations</label>
          <div className="chip-group">
            {SPECIALIZATIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={draft.specializations.includes(s) ? "chip is-active" : "chip"}
                onClick={() => toggleSpec(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="field wide">
          <label>Hiring Levels</label>
          <div className="chip-group">
            {HIRING_LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                className={draft.hiringLevels.includes(l) ? "chip is-active" : "chip"}
                onClick={() => toggleLevel(l)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ModalActions
        onCancel={onClose}
        onSubmit={onSubmit}
        disabled={!valid}
        submitLabel="Add Recruiter"
      />
    </ModalShell>
  );
}
