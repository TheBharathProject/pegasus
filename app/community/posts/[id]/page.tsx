"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProductFrame } from "@/components/frames";
import { ChevronLeft, ChevronRight, TrashIcon } from "@/components/icons";
import { isAuthed } from "@/lib/auth";
import { goTo } from "@/lib/paths";
import {
  createCommunityComment,
  flagCommunityPost,
  getCommunityPost,
  listCommunityComments,
  softDeleteCommunityComment,
  softDeleteCommunityPost,
  voteCommunityPost
} from "@/lib/community";
import type { ApiCommunityComment, ApiCommunityPost } from "@/lib/api-client";

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

export default function CommunityPostPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const postId = params?.id ?? "";

  const [post, setPost] = useState<ApiCommunityPost | null>(null);
  const [comments, setComments] = useState<ApiCommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);

  // New-comment composer state.
  const [composerBody, setComposerBody] = useState("");
  const [posting, setPosting] = useState(false);

  // Optimistic vote state. Real backend roundtrip happens on every click;
  // we mirror the result locally so the UI is always in sync.
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !isAuthed()) {
      goTo("/login");
      return;
    }
    if (!postId) return;
    let cancelled = false;
    Promise.all([getCommunityPost(postId), listCommunityComments(postId)])
      .then(([p, c]) => {
        if (cancelled) return;
        setPost(p);
        setComments(c.items);
      })
      .catch(() => {
        if (cancelled) return;
        // Stay null; render the not-found state.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // /me JWT read for "is this my post?" affordances. The Pegasus
    // token shape isn't exposed here so we just match by user id once
    // the post arrives — a tiny fetch to /me confirms.
    const grabMe = async () => {
      try {
        const u = await import("@/lib/api-client").then((m) => m.api.get<{ id: string }>("/job-tracker/me"));
        if (!cancelled) setMeId(u.id);
      } catch {
        // Anon-equivalent — no author affordances render.
      }
    };
    void grabMe();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const handleVote = async (next: -1 | 0 | 1) => {
    if (!post || voting) return;
    const target = post.myVote === next ? 0 : next;
    const delta = target - post.myVote;
    setVoting(true);
    // Optimistic update.
    setPost({ ...post, myVote: target as -1 | 0 | 1, voteCount: post.voteCount + delta });
    try {
      await voteCommunityPost(post.id, target as -1 | 0 | 1);
    } catch (e) {
      // Rollback.
      setPost(post);
      window.alert(`Vote failed: ${(e as Error).message}`);
    } finally {
      setVoting(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post || posting || !composerBody.trim()) return;
    setPosting(true);
    try {
      const comment = await createCommunityComment(post.id, composerBody.trim());
      setComments([...comments, comment]);
      setComposerBody("");
      setPost({ ...post, commentCount: post.commentCount + 1 });
    } catch (e) {
      window.alert(`Could not post comment: ${(e as Error).message}`);
    } finally {
      setPosting(false);
    }
  };

  const handleDeletePost = async () => {
    if (!post) return;
    if (!window.confirm("Delete this post? Comments stay but the post text disappears.")) return;
    try {
      await softDeleteCommunityPost(post.id);
      router.push(`/community/${post.surface}`);
    } catch (e) {
      window.alert(`Delete failed: ${(e as Error).message}`);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Delete your comment?")) return;
    try {
      await softDeleteCommunityComment(commentId);
      setComments((cs) =>
        cs.map((c) =>
          c.id === commentId ? { ...c, status: "removed", body: "" } : c
        )
      );
    } catch (e) {
      window.alert(`Delete failed: ${(e as Error).message}`);
    }
  };

  const handleFlag = async () => {
    if (!post) return;
    if (!window.confirm("Flag this post for moderator review?")) return;
    try {
      await flagCommunityPost(post.id);
      window.alert("Flagged. Thanks for the heads-up.");
    } catch (e) {
      window.alert(`Could not flag: ${(e as Error).message}`);
    }
  };

  if (loading) {
    return (
      <ProductFrame active="community" title="Post" intro="Loading…">
        <p className="muted small">Loading…</p>
      </ProductFrame>
    );
  }

  if (!post || post.status === "removed") {
    return (
      <ProductFrame active="community" title="Post" intro="Not found">
        <p className="muted">
          That post is gone. <Link href="/community/ask">Browse the community</Link>.
        </p>
      </ProductFrame>
    );
  }

  const isAuthor = meId && post.userId === meId;

  return (
    <ProductFrame
      active="community"
      title={post.title}
      currentPath={`/community/${post.surface}`}
      kicker={
        <Link
          href={`/community/${post.surface}`}
          className="post-back"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <ChevronLeft width={12} height={12} /> Back to {post.surface}
        </Link>
      }
      intro={`By ${post.authorName || "Anonymous"}${post.authorSlug ? ` (@${post.authorSlug})` : ""} · ${fmtRelative(post.createdAt)}`}
      actions={
        isAuthor ? (
          <button className="ghost-button" type="button" onClick={handleDeletePost}>
            <TrashIcon width={12} height={12} /> Delete
          </button>
        ) : (
          <button className="ghost-button" type="button" onClick={handleFlag}>
            Flag
          </button>
        )
      }
    >
      <article className="post-detail">
        {post.body ? <p className="post-detail-body">{post.body}</p> : null}

        {/* Per-surface metadata pills. Best-effort rendering of common
            keys; unknown shapes just show the raw stringified value. */}
        <PostMetadata metadata={post.metadata} surface={post.surface} />

        <div className="post-detail-actions">
          <button
            className={post.myVote === 1 ? "vote-button is-active" : "vote-button"}
            type="button"
            onClick={() => handleVote(1)}
            disabled={voting}
            aria-label="Upvote"
          >
            ↑ {post.voteCount}
          </button>
          <span className="muted small">
            {post.commentCount} {post.commentCount === 1 ? "reply" : "replies"}
          </span>
        </div>
      </article>

      <section className="post-comments">
        <h2>Replies</h2>
        {comments.length === 0 ? (
          <p className="muted small" style={{ marginTop: 14 }}>
            No replies yet. Be the first.
          </p>
        ) : (
          <ul className="comment-list">
            {comments.map((c) => (
              <li key={c.id} className="comment-row">
                <div className="comment-head">
                  <strong>{c.authorName || "Anonymous"}</strong>
                  <span className="muted small">{fmtRelative(c.createdAt)}</span>
                </div>
                {c.status === "removed" ? (
                  <p className="comment-body comment-body--removed">[deleted]</p>
                ) : (
                  <p className="comment-body">{c.body}</p>
                )}
                {meId === c.userId && c.status === "active" ? (
                  <button
                    className="ghost-button comment-delete"
                    type="button"
                    onClick={() => handleDeleteComment(c.id)}
                  >
                    Delete
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <form className="comment-composer" onSubmit={handlePostComment}>
          <textarea
            placeholder="Write a reply…"
            value={composerBody}
            onChange={(e) => setComposerBody(e.target.value)}
            disabled={posting}
            maxLength={8192}
            rows={3}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            <button
              type="submit"
              className="primary-button"
              disabled={posting || !composerBody.trim()}
            >
              {posting ? "Posting…" : (
                <>
                  Reply <ChevronRight width={11} height={11} />
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </ProductFrame>
  );
}

function PostMetadata({
  metadata,
  surface
}: {
  metadata: Record<string, unknown>;
  surface: ApiCommunityPost["surface"];
}) {
  if (!metadata || Object.keys(metadata).length === 0) return null;

  const pills: { label: string; value: string }[] = [];

  // Per-surface picks. Only render fields that are actually populated;
  // skip empty strings + arrays.
  if (surface === "experiences") {
    if (metadata.company) pills.push({ label: "Company", value: String(metadata.company) });
    if (metadata.role) pills.push({ label: "Role", value: String(metadata.role) });
    if (metadata.outcome) pills.push({ label: "Outcome", value: String(metadata.outcome) });
    if (metadata.difficulty) pills.push({ label: "Difficulty", value: String(metadata.difficulty) });
    if (metadata.location) pills.push({ label: "Location", value: String(metadata.location) });
    if (metadata.yearsOfExperience) pills.push({ label: "YOE", value: String(metadata.yearsOfExperience) });
  } else if (surface === "referrals") {
    if (metadata.company) pills.push({ label: "Company", value: String(metadata.company) });
    if (Array.isArray(metadata.roles) && metadata.roles.length) {
      pills.push({ label: "Roles", value: (metadata.roles as string[]).join(" · ") });
    }
    if (Array.isArray(metadata.locations) && metadata.locations.length) {
      pills.push({ label: "Locations", value: (metadata.locations as string[]).join(" · ") });
    }
    if (metadata.deadline) pills.push({ label: "Deadline", value: String(metadata.deadline) });
  } else if (surface === "recruiters") {
    if (metadata.recruiter) pills.push({ label: "Recruiter", value: String(metadata.recruiter) });
    if (metadata.company) pills.push({ label: "Company", value: String(metadata.company) });
    if (metadata.title) pills.push({ label: "Title", value: String(metadata.title) });
    if (Array.isArray(metadata.specializations) && metadata.specializations.length) {
      pills.push({ label: "Specializations", value: (metadata.specializations as string[]).join(", ") });
    }
  } else if (surface === "ask") {
    if (Array.isArray(metadata.tags) && metadata.tags.length) {
      pills.push({ label: "Tags", value: (metadata.tags as string[]).join(", ") });
    }
  } else if (surface === "reviews") {
    if (metadata.targetRole) pills.push({ label: "Target", value: String(metadata.targetRole) });
    if (metadata.level) pills.push({ label: "Level", value: String(metadata.level) });
  }

  if (pills.length === 0) return null;

  return (
    <ul className="post-meta-pills">
      {pills.map((p) => (
        <li key={p.label}>
          <span className="post-meta-pill-label">{p.label}</span>
          <span className="post-meta-pill-value">{p.value}</span>
        </li>
      ))}
    </ul>
  );
}
