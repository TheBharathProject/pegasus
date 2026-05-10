import type { Metadata } from "next";
import { MarketingFrame } from "@/components/frames";

export const metadata: Metadata = {
  title: "Privacy Policy · Pegasus",
  description:
    "How Pegasus collects, uses, stores, and protects job tracking data from the Pegasus browser extension.",
  alternates: {
    canonical: "https://sypher.in/pegasus/privacy-policy"
  }
};

const sections: Array<{
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}> = [
  {
    heading: "Information we collect",
    paragraphs: [
      "Pegasus may collect and store the minimum information required to help you track job opportunities you want to save, apply to, or manage."
    ],
    bullets: [
      "Job listing and application details such as company name, job title, application status, notes, and job links.",
      "Website content from supported job platforms when it is required to extract and organize job application information.",
      "Browser tab URLs and page metadata related to supported job application pages.",
      "User account information necessary for syncing application data across devices."
    ]
  },
  {
    heading: "What we do not collect",
    paragraphs: [
      "Pegasus does not collect sensitive personal information such as passwords, payment information, health information, or personal communications."
    ]
  },
  {
    heading: "How we use information",
    paragraphs: [
      "Collected information is used only to provide Pegasus's core functionality."
    ],
    bullets: [
      "Extract job application details from supported websites.",
      "Organize and display tracked job opportunities.",
      "Sync and manage job application data across multiple user devices.",
      "Help users manage their job application workflow."
    ]
  },
  {
    heading: "Data storage and syncing",
    paragraphs: [
      "Job application data may be securely transmitted to and stored on Sypher.in servers so it can sync across devices connected to the same user account."
    ]
  },
  {
    heading: "Data sharing",
    paragraphs: [
      "Pegasus does not sell, rent, or share user data with third parties for advertising or marketing purposes.",
      "User data is only used to provide the core functionality of Pegasus, including cross-device synchronization and job application tracking.",
      "Pegasus does not use collected data for advertising, profiling, creditworthiness assessment, or lending purposes."
    ]
  },
  {
    heading: "Remote code",
    paragraphs: [
      "Pegasus does not use remote code. All extension functionality is packaged within the published extension bundle."
    ]
  },
  {
    heading: "Security",
    paragraphs: [
      "Reasonable technical and organizational measures are implemented to help protect user data during transmission and storage."
    ]
  },
  {
    heading: "Changes to this policy",
    paragraphs: [
      "This privacy policy may be updated periodically to reflect changes in functionality or legal requirements. Continued use of Pegasus after updates constitutes acceptance of the revised policy."
    ]
  },
  {
    heading: "Contact",
    paragraphs: [
      "Questions about this Privacy Policy can be sent to Pegasus Support at buildwithshubham.dixit@gmail.com."
    ]
  }
];

export default function PrivacyPolicyPage() {
  return (
    <MarketingFrame>
      <main className="nc-section">
        <div className="nc-section-inner">
          <article className="legal-doc">
            <header className="legal-doc-head">
              <p className="nc-eyebrow">Pegasus · Privacy policy</p>
              <h1 className="legal-doc-title">Privacy Policy for Pegasus</h1>
              <p className="legal-doc-dek">
                Pegasus is a browser extension designed to help users track job opportunities,
                including jobs they are interested in, have applied to, or are actively managing.
              </p>
              <p className="legal-doc-stamp">Effective date · May 10, 2026</p>
            </header>

            <div className="legal-doc-body">
              {sections.map((section) => (
                <section key={section.heading}>
                  <h2>{section.heading}</h2>
                  {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {section.bullets ? (
                    <ul>
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          </article>
        </div>
      </main>
    </MarketingFrame>
  );
}
