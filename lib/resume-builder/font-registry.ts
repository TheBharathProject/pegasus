// Font registry — single source of truth for the paired font picker.
//
// Each entry pairs a CSS web stack (used by the HTML preview at
// components/resume-builder/preview.tsx) with a LaTeX preamble snippet
// (used by sypher-api/.../classic-v2.tex.tmpl) so picking a font from
// the Style section shows the same family in BOTH the preview and the
// compiled PDF.
//
// The web stacks lean on widely-installed system fonts (Helvetica,
// Times, Palatino, Charter) so we don't need to self-host most. Latin
// Modern Roman is the one outlier — without a CMU Serif woff2 in
// /public/fonts, the web side falls through to Charter/Georgia.
// That's a known follow-up; the PDF side renders LMR correctly today.

export type FontFamilyId =
  | "lmodern"
  | "helvetica"
  | "times"
  | "palatino"
  | "charter"
  | "ebgaramond";

export interface FontDef {
  id: FontFamilyId;
  label: string;
  webStack: string;
}

export const FONTS: Record<FontFamilyId, FontDef> = {
  lmodern: {
    id: "lmodern",
    label: "Latin Modern Roman",
    webStack:
      `"Latin Modern Roman", "CMU Serif", "Computer Modern", "Charter", "Iowan Old Style", Georgia, serif`
  },
  helvetica: {
    id: "helvetica",
    label: "Helvetica",
    webStack: `"Helvetica Neue", Helvetica, Arial, sans-serif`
  },
  times: {
    id: "times",
    label: "Times Roman",
    webStack: `"Times New Roman", Times, "Liberation Serif", serif`
  },
  palatino: {
    id: "palatino",
    label: "Palatino",
    webStack: `Palatino, "Palatino Linotype", "Book Antiqua", "URW Palladio L", serif`
  },
  charter: {
    id: "charter",
    label: "Charter",
    webStack: `Charter, "Bitstream Charter", "Iowan Old Style", Georgia, serif`
  },
  ebgaramond: {
    id: "ebgaramond",
    label: "EB Garamond",
    // The next/font/google init in app/layout.tsx exposes the EB
    // Garamond face under this CSS variable. Falls back to a Garamond
    // system stack if the variable is somehow unset.
    webStack: `var(--font-eb-garamond), "EB Garamond", Garamond, "Adobe Garamond Pro", serif`
  }
};

export const DEFAULT_FONT_ID: FontFamilyId = "lmodern";

export const FONT_OPTIONS: FontDef[] = [
  FONTS.lmodern,
  FONTS.charter,
  FONTS.times,
  FONTS.palatino,
  FONTS.ebgaramond,
  FONTS.helvetica
];

// Old drafts stored "serif" / "sans" — map them to the closest new IDs.
// Anything unknown falls back to the default (Latin Modern Roman) so the
// preview never blanks and the PDF never crashes on a bad value.
export function normalizeFontFamily(v: string | undefined | null): FontFamilyId {
  if (!v) return DEFAULT_FONT_ID;
  if (v === "sans") return "helvetica";
  if (v === "serif") return "lmodern";
  return (FONTS as Record<string, FontDef | undefined>)[v]
    ? (v as FontFamilyId)
    : DEFAULT_FONT_ID;
}
