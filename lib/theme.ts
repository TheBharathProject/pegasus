// Theme helpers — paired with the inline boot script in app/layout.tsx.
// Stored under "sypher.theme" so the choice persists across every Sypher
// tool on the same origin (sypher.in/pegasus, sypher.in/blog, etc.).

export type ThemePref = "system" | "light" | "dark";
export type ThemeResolved = "light" | "dark";

export const THEME_KEY = "sypher.theme";

export function getStoredTheme(): ThemePref {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {}
  return "system";
}

export function setStoredTheme(t: ThemePref): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_KEY, t);
  } catch {}
  applyTheme(resolveTheme(t));
}

export function resolveTheme(pref: ThemePref): ThemeResolved {
  if (pref === "light" || pref === "dark") return pref;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(resolved: ThemeResolved): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolved;
}

// Subscribe to OS preference changes — only takes effect when the stored
// pref is "system". Returns an unsubscribe function for useEffect cleanup.
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(prefers-color-scheme: light)");
  const handler = () => onChange();
  mql.addEventListener("change", handler);
  return () => mql.removeEventListener("change", handler);
}
