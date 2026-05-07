import Link from "next/link";
import { MarketingFrame } from "@/components/frames";
import { blogPosts } from "@/lib/site-data";

export default function BlogIndexPage() {
  return (
    <MarketingFrame current="blog">
      <main className="section shell">
        <div className="section-heading">
          <p className="eyebrow">Blog</p>
          <h1>Notes on the job search</h1>
          <p className="section-copy">
            Practical advice for tracking applications, writing better resumes, and navigating the
            hiring process.
          </p>
        </div>
        <div className="card-grid columns-3">
          {blogPosts.map((post) => (
            <Link className="blog-card" href={`/blog/${post.slug}`} key={post.slug}>
              <p className="muted small">
                {post.date} · {post.readTime}
              </p>
              <h3>{post.title}</h3>
              <p>{post.excerpt}</p>
              <div className="tag-row">
                {post.tags.map((tag) => (
                  <span className="pill" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </MarketingFrame>
  );
}
