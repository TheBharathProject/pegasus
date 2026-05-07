import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingFrame } from "@/components/frames";
import { blogPosts, getBlogPost } from "@/lib/site-data";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export default function BlogArticlePage({ params }: { params: { slug: string } }) {
  const post = getBlogPost(params.slug);

  if (!post) {
    notFound();
  }

  return (
    <MarketingFrame current="blog">
      <main className="section shell">
        <article className="prose-article">
          <Link className="ghost-button" href="/blog">
            All posts
          </Link>
          <div style={{ marginTop: 28 }}>
            <p className="muted small">
              {post.date} · {post.readTime}
            </p>
            <h1 style={{ marginTop: 18 }}>{post.title}</h1>
            <p className="section-copy" style={{ marginLeft: 0 }}>
              {post.excerpt}
            </p>
            <div className="tag-row">
              {post.tags.map((tag) => (
                <span className="pill" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
          {post.content.map((section, index) => (
            <section key={`${post.slug}-${index}`}>
              {section.heading ? <h2>{section.heading}</h2> : null}
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>
      </main>
    </MarketingFrame>
  );
}
