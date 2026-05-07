import { MarketingFrame } from "@/components/frames";

export default function TermsPage() {
  return (
    <MarketingFrame current="terms">
      <main className="section shell">
        <article className="prose-article">
          <p className="eyebrow">Terms</p>
          <h1>Terms for the clone</h1>
          <p>
            The original product exposes terms and privacy routes. This clone recreates the route
            structure and information architecture but not the original legal text.
          </p>
          <p>
            Treat this project as a design-and-code starting point. Replace all placeholder policy
            content before using it in a real service.
          </p>
        </article>
      </main>
    </MarketingFrame>
  );
}
