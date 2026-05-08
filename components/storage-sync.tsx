"use client";

import { useEffect } from "react";
import { applyTheme, getStoredTheme, resolveTheme, watchSystemTheme } from "@/lib/theme";

// StorageSync — mounted once at the layout root. Listens to the browser's
// native `storage` event so a localStorage change made in *another* tab
// (or in another Sypher tool on the same origin, e.g. sypher.in/blog
// while you're sitting on sypher.in/pegasus/dashboard) propagates here
// without a page reload.
//
// Why this is necessary: localStorage's `storage` event is dispatched in
// every tab on the origin EXCEPT the tab that wrote it. Same-tab updates
// already work via direct mutation — applyTheme() is called from the
// settings picker, useAuth listens to the in-tab "sypher:auth-changed"
// custom event for the JWT, etc. This component catches the cross-tab gap.
//
// Add new keys to the switch as more shared state lands. The deliberate
// taste here is "one routing point, one mental model" — every shared
// localStorage key lists itself once, instead of each consumer racing to
// install its own handler.

const KEYS = {
  THEME: "sypher.theme",
  SIDEBAR: "nc.sidebar-collapsed",
  // sypher_jwt is handled by the existing useAuth() hook in lib/auth.ts —
  // it dispatches a custom event AND listens to the native `storage` event.
  // We don't double-handle it here; listed for documentation only.
  JWT: "sypher_jwt",
} as const;

export function StorageSync() {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // e.key is null when storage is cleared whole-cloth — re-apply
      // everything in that case so we don't end up half-themed.
      if (e.key === null) {
        applyTheme(resolveTheme(getStoredTheme()));
        applySidebarFromStorage();
        return;
      }
      switch (e.key) {
        case KEYS.THEME:
          applyTheme(resolveTheme(getStoredTheme()));
          break;
        case KEYS.SIDEBAR:
          applySidebarFromStorage();
          break;
        // Other keys (jwt, notes-pending, device-id) have their own
        // listeners or are write-once. Skip — the goal here is to be
        // explicit about *which* keys are theme/chrome-shaped.
        default:
          break;
      }
    };
    window.addEventListener("storage", onStorage);

    // Also keep the live OS-pref watcher running while pref is "system".
    // resolveTheme() consults matchMedia at the moment of call, so a
    // single watcher is enough — it just re-applies on change.
    const stopWatcher = watchSystemTheme(() => {
      const pref = getStoredTheme();
      if (pref === "system") applyTheme(resolveTheme(pref));
    });

    return () => {
      window.removeEventListener("storage", onStorage);
      stopWatcher();
    };
  }, []);

  return null;
}

function applySidebarFromStorage() {
  if (typeof document === "undefined") return;
  let v: string | null = null;
  try {
    v = window.localStorage.getItem(KEYS.SIDEBAR);
  } catch {}
  document.documentElement.dataset.sb = v === "0" ? "expanded" : "collapsed";
}
