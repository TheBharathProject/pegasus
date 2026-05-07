"use client";

// Browser-side JWT storage. Token comes from /auth/callback?token=...
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

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  pictureUrl?: string;
  timezone: string;
};

export type AuthState = {
  authed: boolean;
  loading: boolean;
  user: AuthUser | null;
};

const apiBase = (): string =>
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

// useAuth subscribes to localStorage changes (this tab + other tabs) and
// keeps `user` populated by hitting GET /job-tracker/me when a token is
// present. Components reading this hook re-render on sign-in / sign-out
// without a page reload.
//
// We don't import the typed api client here on purpose — `lib/auth.ts` is
// a leaf so `lib/api-client.ts` can import from it without a cycle.
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    authed: false,
    loading: true,
    user: null
  });

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const token = getToken();
      if (!token) {
        if (!cancelled) setState({ authed: false, loading: false, user: null });
        return;
      }
      setState((s) => ({ ...s, loading: true }));
      try {
        const res = await fetch(`${apiBase()}/job-tracker/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          // Likely 401 expired. Clear and treat as logged-out — but DON'T
          // navigate from inside the hook; the api-client interceptor and
          // the host page handle that.
          if (res.status === 401) {
            try {
              window.localStorage.removeItem(TOKEN_KEY);
            } catch {}
          }
          if (!cancelled) setState({ authed: false, loading: false, user: null });
          return;
        }
        const user = (await res.json()) as AuthUser;
        if (!cancelled) setState({ authed: true, loading: false, user });
      } catch {
        if (!cancelled) setState({ authed: false, loading: false, user: null });
      }
    };

    refresh();

    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) refresh();
    };
    const onCustom = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener(AUTH_EVENT, onCustom);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AUTH_EVENT, onCustom);
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
