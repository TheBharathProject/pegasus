import { MarketingFrame } from "@/components/frames";

export default function PrivacyPage() {
  return (
    <MarketingFrame current="privacy">
      <main className="section shell">
        <article className="prose-article">
          <p className="eyebrow">Privacy</p>
          <h1>Privacy at the product level</h1>
          <p>
            The live marketing copy repeatedly emphasizes three themes: data stays in your account,
            it is encrypted in transit, and it is not sold or shared.
          </p>
          <p>
            This clone keeps those same expectations in the copy, but it does not implement a real
            production privacy system. Before shipping, you would still need storage retention
            policies, deletion flows, audit logging, and a written legal policy.
          </p>
        </article>
      </main>
    </MarketingFrame>
  );
}
