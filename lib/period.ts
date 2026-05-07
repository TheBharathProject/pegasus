// Year-resolution helpers that bridge the existing free-text "period"
// prompt UX (e.g. window.prompt("Period (2024 - Present)")) with the
// structured {startDate, endDate, current} shape the backend now stores.
//
// Both functions are tolerant: empty / unparseable input yields an empty
// result; never throw.

export type PeriodFields = {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;
  current?: boolean;
};

export type ParsedPeriod = {
  startDate?: string;
  endDate?: string;
  current: boolean;
};

const PRESENT_TOKENS = new Set(["present", "current", "now", "ongoing", "today"]);

// formatPeriod synthesises the original "2024 – Present" / "2024 – 2025"
// display string from structured fields. Used everywhere the original UI
// rendered `{exp.period}` or `{ed.period}`.
export function formatPeriod(p: PeriodFields): string {
  const startYear = yearOf(p.startDate);
  const endYear = yearOf(p.endDate);
  if (!startYear && !endYear && !p.current) return "";
  if (startYear && p.current) return `${startYear} – Present`;
  if (startYear && endYear) return `${startYear} – ${endYear}`;
  if (startYear) return startYear;
  if (endYear) return endYear; // unusual, but cover it
  return p.current ? "Present" : "";
}

// parsePeriod takes the user's free-text prompt input and best-efforts a
// structured shape. Examples:
//   "2024 - Present"   → { startDate: "2024-01-01", current: true }
//   "2024 – 2025"      → { startDate: "2024-01-01", endDate: "2025-12-31", current: false }
//   "2024"             → { startDate: "2024-01-01", current: false }
//   "Jan 2024 - Now"   → { startDate: "2024-01-01", current: true }
//   "ongoing"          → { current: true }
//   ""                 → { current: false }
//
// We accept hyphen, en-dash, em-dash, and the words "to" between segments.
export function parsePeriod(raw: string): ParsedPeriod {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return { current: false };

  // Handle "ongoing" / "present" / etc. by themselves.
  if (PRESENT_TOKENS.has(s)) return { current: true };

  // Split on common separators: " - ", " – ", " — ", " to ", "—", "–".
  const parts = s.split(/\s*(?:–|—|-|\bto\b)\s*/i).filter((p) => p.length > 0);
  if (parts.length === 0) return { current: false };

  const startYear = extractYear(parts[0]);
  if (!startYear) return { current: false };

  const result: ParsedPeriod = {
    startDate: `${startYear}-01-01`,
    current: false,
  };

  if (parts.length === 1) return result;

  const tail = parts[parts.length - 1];
  if (PRESENT_TOKENS.has(tail.trim())) {
    result.current = true;
    return result;
  }
  const endYear = extractYear(tail);
  if (endYear) {
    result.endDate = `${endYear}-12-31`;
  }
  return result;
}

function yearOf(iso?: string): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})/);
  return m ? m[1] : "";
}

function extractYear(s: string): string {
  const m = s.match(/(\d{4})/);
  return m ? m[1] : "";
}
