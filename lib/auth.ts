"use client";

// Browser-side JWT storage + shared /me fetcher.
//
// The /me fetch lives at module scope (mirroring lib/billing.ts) so that
// multiple consumers — MarketingAuthCta, SidebarBilling, SidebarUser, any
// page that calls useAuth() — share one in-flight request and one cache
// entry instead of each firing its own /me on mount. Subscribers register
// via the React hook; cache invalidation flows through the AUTH_EVENT
// custom event when a token changes (sign-in / sign-out, cross-tab).

import { useEffect, useState } from "react";

const TOKEN_KEY = "sypher_jwt";
const AUTH_EVENT = "sypher:auth-changed";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore quota / private mode errors */
  }
  // The native `storage` event only fires in *other* tabs. Dispatch a custom
  // event so this tab's components react too.
  try {
    window.dispatchEvent(new Event(AUTH_EVENT));
  } catch {}
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(AUTH_EVENT));
  } catch {}
}

export function isAuthed(): boolean {
  return !!getToken();
}

export function loginUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    "http://localhost:8000";
  return `${base}/auth/google`;
}

// ---- Reactive hook -----------------------------------------------------

// AuthUser mirrors the backend `/job-tracker/me` payload — same shape as
// the `ApiUser` alias in lib/api-client.ts. Kept locally so this file
// stays a leaf module (api-client imports from here, not the other way).
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  pictureUrl?: string;
  timezone: string;
  isPremium: boolean;
  emailNotificationsEnabled: boolean;
};

export type AuthState = {
  authed: boolean;
  loading: boolean;
  user: AuthUser | null;
};

const apiBase = (): string =>
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

// ---- Module-level cache + pub-sub --------------------------------------
//
// One cache, one inflight, one set of subscribers. Three consumers of
// useAuth() inside ProductFrame used to fire three /me requests on every
// mount. Now they share this state and the inflight Promise dedups
// concurrent callers (including React Strict Mode's dev-only second
// useEffect pass).

const TTL_MS = 60_000;

type CacheEntry = { user: AuthUser | null; fetchedAt: number };
let cache: CacheEntry | null = null;
let inflight: Promise<AuthUser | null> | null = null;
const subscribers = new Set<(s: AuthState) => void>();

function notify(state: AuthState): void {
  subscribers.forEach((cb) => {
    try {
      cb(state);
    } catch {
      /* a subscriber's setState should never throw; if it does, the others
         shouldn't pay for it */
    }
  });
}

// Synchronous derivation of AuthState from the current cache. Used both
// as the initial useState value and inside fetchMe to broadcast.
function stateFromCache(): AuthState {
  if (!cache) return { authed: false, loading: true, user: null };
  return {
    authed: !!cache.user,
    loading: false,
    user: cache.user
  };
}

// fetchMe is the single source of truth for /job-tracker/me. Multiple
// concurrent callers share `inflight`; callers within the TTL window
// hit the cache and skip the network entirely. Notify fires once when
// fresh data lands, so every subscriber updates from the same response.
async function fetchMe(opts?: { force?: boolean }): Promise<AuthUser | null> {
  const now = Date.now();
  if (!opts?.force && cache && now - cache.fetchedAt < TTL_MS) {
    // Notify on cache hit so a subscriber that mounts AFTER another
    // useAuth() has already populated the cache still gets flipped out
    // of its initial loading:true state. Without this, the second
    // hook's setState is never called and it stays stuck.
    notify(stateFromCache());
    return cache.user;
  }
  if (inflight) return inflight;

  const token = getToken();
  if (!token) {
    cache = { user: null, fetchedAt: now };
    notify(stateFromCache());
    return null;
  }

  inflight = (async () => {
    try {
      const res = await fetch(`${apiBase()}/job-tracker/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        // Likely 401 expired. Clear locally so the next read sees no token
        // and other hooks (api-client interceptor, host page) drive the
        // redirect.
        if (res.status === 401) {
          try {
            window.localStorage.removeItem(TOKEN_KEY);
          } catch {}
        }
        cache = { user: null, fetchedAt: Date.now() };
        notify(stateFromCache());
        return null;
      }
      const user = (await res.json()) as AuthUser;
      cache = { user, fetchedAt: Date.now() };
      notify(stateFromCache());
      return user;
    } catch {
      cache = { user: null, fetchedAt: Date.now() };
      notify(stateFromCache());
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// invalidateMe clears the cache so the next read hits the network.
// Wire this up wherever something happens that should change /me state
// (e.g. profile name edit) — sign-out / sign-in already flow through
// the AUTH_EVENT path below.
export function invalidateMe(): void {
  cache = null;
  inflight = null;
}

// getMe is the imperative entry point — for pages that do a one-shot
// /me read inside a useEffect without subscribing to live updates.
// Shares the same cache + inflight as useAuth(), so dashboard /
// settings / post-detail calling getMe() doesn't duplicate the work
// the sidebar is already doing.
export async function getMe(): Promise<AuthUser | null> {
  return fetchMe();
}

// Single set of cross-tab + same-tab listeners. The previous per-hook
// listeners caused N concurrent /me calls every time a token flipped.
if (typeof window !== "undefined") {
  const refresh = () => {
    invalidateMe();
    // No subscribers? Don't bother fetching — the next mount will trigger
    // it lazily.
    if (subscribers.size > 0) {
      void fetchMe({ force: true });
    }
  };
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key === TOKEN_KEY) refresh();
  });
  window.addEventListener(AUTH_EVENT, refresh);
}

// useAuth is a thin React adapter over the module-level cache + pub-sub.
// Initial state reads the cache synchronously (no flash of "loading"
// when a previous mount already resolved /me). On mount, registers a
// subscriber and triggers fetchMe — which is a no-op if the cache is
// fresh and a single shared request otherwise.
//
// We don't import the typed api client here on purpose — `lib/auth.ts`
// is a leaf so `lib/api-client.ts` can import from it without a cycle.
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(stateFromCache);

  useEffect(() => {
    const cb = (s: AuthState) => setState(s);
    subscribers.add(cb);
    // Trigger a (possibly cached) read so this hook reflects the latest
    // /me. fetchMe handles dedup; multiple mounts result in one fetch.
    void fetchMe();
    return () => {
      subscribers.delete(cb);
    };
  }, []);

  return state;
}

// signOut centralises the sign-out flow so MarketingFrame, ProductFrame,
// Settings, etc. all behave the same: best-effort POST /auth/logout, clear
// the token (which dispatches the auth-changed event), then navigate.
export async function signOut(redirectTo: string = "/"): Promise<void> {
  const token = getToken();
  try {
    await fetch(`${apiBase()}/auth/logout`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
  } catch {
    /* network errors are fine — we still clear locally */
  }
  clearToken();
  if (typeof window !== "undefined") {
    window.location.href = redirectTo;
  }
}
