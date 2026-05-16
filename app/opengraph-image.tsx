import { ImageResponse } from "next/og";

// Dynamic Open Graph + Twitter card image for sypher.in/pegasus.
// Rendered on the edge by next/og at request time, so we don't need a
// designed PNG sitting in /public. Next.js auto-detects this file and
// injects the right <meta property="og:image"> tag in the home route.
//
// Visual identity matches the Pegasus app's dark theme tokens
// (globals.css :root):
//   --bg:              #1a1a1a   page background
//   --bg-soft:         #1f1f1f   inner panel
//   --text:            #ececea   warm-white title
//   --text-soft:       #b3b1ab   muted tagline
//   --stage-interest:  #efe7d2   warm-cream accent
//
// Custom fonts (Lyon Display) are intentionally NOT loaded here —
// keeps the edge function fast and dependency-free. next/og's default
// sans-serif is clean; the visual signature comes from composition,
// colour, and a single accent rule.

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Pegasus — a calm job application tracker";

export default async function OGImage() {
  const TAGLINE =
    "A calm job application tracker for managing roles, recruiter conversations, resumes, and next steps.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          background: "#1a1a1a",
          fontFamily:
            "ui-serif, Georgia, 'Times New Roman', serif",
          color: "#ececea"
        }}
      >
        {/* Left accent strip — a 12px warm-cream rule running the full
            height. Anchors the eye on the left without dominating. */}
        <div
          style={{
            width: 12,
            height: "100%",
            background: "#efe7d2"
          }}
        />

        {/* Main composition pane. Generous padding, vertical centre,
            content left-aligned for a calm editorial feel. */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "80px 96px"
          }}
        >
          {/* Eyebrow — tiny, mono-cased label. */}
          <div
            style={{
              fontSize: 22,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "#b3b1ab",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
            }}
          >
            sypher.in / pegasus
          </div>

          {/* Title — big editorial serif. */}
          <div
            style={{
              fontSize: 168,
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              fontWeight: 400,
              color: "#ececea",
              marginTop: 28
            }}
          >
            Pegasus
          </div>

          {/* Underline accent — warm cream, thin, deliberate. */}
          <div
            style={{
              width: 96,
              height: 3,
              background: "#efe7d2",
              marginTop: 36
            }}
          />

          {/* Tagline — muted, comfortable measure. */}
          <div
            style={{
              fontSize: 34,
              lineHeight: 1.32,
              color: "#b3b1ab",
              marginTop: 36,
              maxWidth: 820
            }}
          >
            {TAGLINE}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
