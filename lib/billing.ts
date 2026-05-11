// Tiny billing-snapshot cache. The /billing/me endpoint is consulted
// from several mount points (Settings page, Upgrade page, Sidebar
// credits widget, AI feature dialogs). Without a shared cache they
// each re-fetch on mount — that's the §8.2 over-fetch issue we noted
// in the audit. React Query / SWR would be overkill for one endpoint;
// a module-level promise with a 30s TTL covers the cases that matter.
//
// Invalidate manually after any action that should change billing
// state (successful checkout return, cancel, AI debit), via
// invalidateBillingMe().

import { useCallback, useEffect, useState } from "react";

import { api, type ApiBillingMe } from "@/lib/api-client";

const TTL_MS = 30_000;

// Per-process cache. Keyed on the singleton "current user" so the
// inflight promise is shared across mounts. Cleared by sign-out via
// invalidateBillingMe() below (called from lib/auth on token clear).
type CacheEntry = {
  fetchedAt: number;
  data: ApiBillingMe;
};

let cache: CacheEntry | null = null;
let inflight: Promise<ApiBillingMe> | null = null;

// fetchBillingMe is the cached, deduped, TTL-aware /billing/me fetcher.
// Multiple concurrent callers share the same Promise; subsequent calls
// inside the TTL window return cached data without hitting the network.
export async function fetchBillingMe(opts?: { force?: boolean }): Promise<ApiBillingMe> {
  const now = Date.now();
  if (!opts?.force && cache && now - cache.fetchedAt < TTL_MS) {
    return cache.data;
  }
  if (inflight) return inflight;
  inflight = api
    .get<ApiBillingMe>("/billing/me")
    .then((data) => {
      cache = { fetchedAt: Date.now(), data };
      inflight = null;
      return data;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

// invalidateBillingMe clears the cache. Call after any action that
// could change billing state (post-checkout return, cancel, AI debit).
// Next fetchBillingMe() call will hit the network.
export function invalidateBillingMe(): void {
  cache = null;
}

// Auto-invalidate on sign-out / cross-tab auth changes. lib/auth.ts
// dispatches `sypher:auth-changed` whenever the token storage flips.
// Listening here keeps billing.ts as the single owner of its cache —
// no cross-file invalidation calls needed in auth.ts itself.
if (typeof window !== "undefined") {
  window.addEventListener("sypher:auth-changed", () => {
    cache = null;
  });
}

// useBillingMe is the React hook flavour. Returns the snapshot + a
// refresh function. `null` while loading; throws via the unhandled
// promise rejection if fetch fails — components that care should wrap.
export function useBillingMe(): {
  billing: ApiBillingMe | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
} {
  const [billing, setBilling] = useState<ApiBillingMe | null>(cache?.data ?? null);
  const [loading, setLoading] = useState<boolean>(!cache);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback((force?: boolean) => {
    setLoading(true);
    fetchBillingMe({ force })
      .then((data) => {
        setBilling(data);
        setError(null);
      })
      .catch((e) => {
        setError(e as Error);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);
  return { billing, loading, error, refresh };
}

// Per-operation credit costs, mirrored from internal/billing/costs.go.
// Keep in sync — the backend is the source of truth but the FE shows
// "this will cost N credits" without an extra round-trip.
export const CREDIT_COSTS = {
  resumeReport: 25,
  resumeTweak: 20,
  coverLetter: 10,
} as const;
