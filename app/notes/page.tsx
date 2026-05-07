"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProductFrame } from "@/components/frames";
import {
  BookOpenIcon,
  ChevronDown,
  ChevronLeft,
  CodeIcon,
  EyeIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  RedoIcon,
  SearchIcon,
  SplitIcon,
  TrashIcon,
  UndoIcon
} from "@/components/icons";
import { renderMarkdown } from "@/lib/markdown";
import { api, ApiError, type ApiCategory, type ApiNote, type ApiNoteListItem } from "@/lib/api-client";
import { isAuthed } from "@/lib/auth";
import { goTo } from "@/lib/paths";

type ViewMode = "edit" | "split" | "preview";
type History = { past: string[]; future: string[]; lastPushAt: number };
type Draft = { title: string; body: string; categoryId: string | null };
type SaveStatus = "idle" | "editing" | "saving" | "saved" | "error";

type PendingDraft = {
  title: string;
  body: string;
  categoryId: string | null;
  baseUpdatedAt: string;
  savedAt: string;
  deviceId: string;
};

type ConflictEntry = {
  noteId: string;
  local: PendingDraft;
  server: ApiNote;
};

const PALETTE = ["#8c8984", "#4d82ff", "#8f66ff", "#f0b447", "#55bf8b", "#f05a57", "#3ec1d3", "#ff8c42"];

// Idle: fire a save 15s after the last keystroke.
// Ceiling: while typing continuously, fire a save at least every 60s
// so the server never gets more than a minute behind the user.
const IDLE_DEBOUNCE_MS = 15_000;
const THROTTLE_MAX_MS = 60_000;
const PENDING_KEY = "nc.notes-pending";
const DEVICE_KEY = "nc.device-id";

function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      "d-" +
      Math.random().toString(36).slice(2, 10) +
      "-" +
      Date.now().toString(36);
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function loadPending(): Record<string, PendingDraft> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PendingDraft>) : {};
  } catch {
    return {};
  }
}

function writePending(noteId: string, draft: PendingDraft) {
  if (typeof window === "undefined") return;
  const all = loadPending();
  all[noteId] = draft;
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(all));
  } catch {
    /* quota — ignore */
  }
}

function clearPending(noteId: string) {
  if (typeof window === "undefined") return;
  const all = loadPending();
  if (!(noteId in all)) return;
  delete all[noteId];
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function fmtRelative(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function NotesPage() {
  const [notes, setNotes] = useState<ApiNoteListItem[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);

  // Two timers run concurrently:
  //   - `debounceTimerRef` resets on every keystroke (idle save).
  //   - `throttleTimerRef` is set the first time after a clean state and
  //     fires once at the ceiling (60s) regardless of activity, so a
  //     non-stop typist still syncs every minute.
  // `latestSaveRef` holds the most recent draft seen so whichever timer
  // wins reads the freshest content.
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSaveRef = useRef<{ noteId: string; draft: Draft } | null>(null);
  const historyRef = useRef<Record<string, History>>({});
  const [, bumpHistory] = useState(0);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  // Cache of base server timestamps captured when we first opened a note.
  // Keyed by noteId. Used to populate `baseUpdatedAt` on pending drafts so
  // the next session can detect concurrent writes from another device.
  const baseUpdatedAtRef = useRef<Record<string, string>>({});

  const refresh = async () => {
    try {
      const [n, c] = await Promise.all([
        api.get<ApiNoteListItem[]>("/job-tracker/notes"),
        api.get<ApiCategory[]>("/job-tracker/notes/categories")
      ]);
      setNotes(n);
      setCategories(c);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && !isAuthed()) {
      goTo("/login");
      return;
    }
    refresh().then(reconcilePending);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Reconcile any unsaved drafts left over from a previous session ---
  // Runs once after the initial load. For each pending draft:
  //   - server unchanged since our base → safe to flush our edits
  //   - server changed by us & content already matches → silent clear
  //   - server changed by another writer → surface as a conflict for the
  //     user to resolve manually
  //   - server returns 404 → note deleted elsewhere, drop the draft
  const reconcilePending = async () => {
    const pending = loadPending();
    const ids = Object.keys(pending);
    if (ids.length === 0) return;
    const myDevice = getDeviceId();
    const newConflicts: ConflictEntry[] = [];

    for (const noteId of ids) {
      const draft = pending[noteId];
      try {
        const server = await api.get<ApiNote>(`/job-tracker/notes/${noteId}`);
        const sameBase = server.updatedAt === draft.baseUpdatedAt;
        if (sameBase) {
          // Our edits are based on the latest server state — safe to push.
          await api.put(`/job-tracker/notes/${noteId}`, {
            title: draft.title,
            content: draft.body,
            pinned: server.pinned,
            categoryId: draft.categoryId ?? undefined
          });
          clearPending(noteId);
          continue;
        }
        // Base mismatch — was the server's newer state caused by our own
        // earlier successful save (race between save-success and
        // clear-localStorage)?
        const sameDevice = draft.deviceId === myDevice;
        const contentMatches =
          server.title === draft.title &&
          server.content === draft.body &&
          (server.categoryId ?? null) === (draft.categoryId ?? null);
        if (sameDevice && contentMatches) {
          clearPending(noteId);
          continue;
        }
        // Genuine concurrent write — let the user pick.
        newConflicts.push({ noteId, local: draft, server });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          // The note no longer exists on the server.
          setError(
            `Note "${draft.title || "Untitled"}" was deleted from another device. Local changes were dropped.`
          );
          clearPending(noteId);
        } else {
          // Network / 5xx — leave the pending draft on disk; we'll try
          // again next time the page loads. Don't fail the whole reconcile.
          // eslint-disable-next-line no-console
          console.warn("Reconcile failed for note", noteId, (e as Error).message);
        }
      }
    }

    if (newConflicts.length > 0) {
      setConflicts((prev) => [...prev, ...newConflicts]);
    }
    // Pull a fresh list now that any safe drafts have been flushed.
    api.get<ApiNoteListItem[]>("/job-tracker/notes").then(setNotes).catch(() => {});
  };

  const resolveKeepMine = async (c: ConflictEntry) => {
    try {
      const updated = await api.put<ApiNote>(`/job-tracker/notes/${c.noteId}`, {
        title: c.local.title,
        content: c.local.body,
        pinned: c.server.pinned,
        categoryId: c.local.categoryId ?? undefined
      });
      clearPending(c.noteId);
      if (updated?.updatedAt) {
        baseUpdatedAtRef.current[c.noteId] = updated.updatedAt;
      }
      setConflicts((cs) => cs.filter((x) => x.noteId !== c.noteId));
      api.get<ApiNoteListItem[]>("/job-tracker/notes").then(setNotes).catch(() => {});
    } catch (e) {
      window.alert(`Could not save: ${(e as Error).message}`);
    }
  };

  const resolveKeepTheirs = (c: ConflictEntry) => {
    clearPending(c.noteId);
    baseUpdatedAtRef.current[c.noteId] = c.server.updatedAt;
    setDrafts((d) => ({
      ...d,
      [c.noteId]: {
        title: c.server.title,
        body: c.server.content,
        categoryId: c.server.categoryId ?? null
      }
    }));
    setConflicts((cs) => cs.filter((x) => x.noteId !== c.noteId));
    api.get<ApiNoteListItem[]>("/job-tracker/notes").then(setNotes).catch(() => {});
  };

  const filteredNotes = useMemo(() => {
    let list = notes;
    if (activeCategoryId === "uncategorized") {
      list = list.filter((n) => !n.categoryId);
    } else if (activeCategoryId !== "all") {
      list = list.filter((n) => n.categoryId === activeCategoryId);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (n) =>
          (n.title || "").toLowerCase().includes(q) ||
          (n.excerpt || "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [notes, activeCategoryId, search]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) ?? null,
    [notes, activeNoteId]
  );

  // Seed the draft when the active note first loads. If a pending draft
  // exists in localStorage for this note we restore it (so the user picks
  // up exactly where they left off after a tab close). Otherwise we fetch
  // the full note from the server — the list endpoint only ships excerpts.
  useEffect(() => {
    if (!activeNote) return;
    // Capture the base server timestamp once per note open. Subsequent
    // refreshes that bring a newer updatedAt won't move this — we want
    // it to track the last *acknowledged* state we based edits on.
    if (!baseUpdatedAtRef.current[activeNote.id]) {
      baseUpdatedAtRef.current[activeNote.id] = activeNote.updatedAt;
    }
    if (drafts[activeNote.id]) return; // already loaded
    const pending = loadPending()[activeNote.id];
    if (pending) {
      setDrafts((prev) => ({
        ...prev,
        [activeNote.id]: {
          title: pending.title,
          body: pending.body,
          categoryId: pending.categoryId
        }
      }));
      return;
    }
    // Fetch full content for the active note.
    const noteId = activeNote.id;
    api
      .get<ApiNote>(`/job-tracker/notes/${noteId}`)
      .then((full) => {
        baseUpdatedAtRef.current[noteId] = full.updatedAt;
        setDrafts((prev) =>
          prev[noteId]
            ? prev
            : {
                ...prev,
                [noteId]: {
                  title: full.title,
                  body: full.content,
                  categoryId: full.categoryId ?? null
                }
              }
        );
      })
      .catch((e: Error) => {
        if (e instanceof ApiError && e.status === 404) {
          setActiveNoteId(null);
        } else {
          setError(e.message);
        }
      });
  }, [activeNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const draft: Draft | null = activeNote
    ? drafts[activeNote.id] ?? {
        title: activeNote.title,
        body: "",
        categoryId: activeNote.categoryId ?? null
      }
    : null;

  const counts = useMemo(() => {
    const out: Record<string, number> = {
      all: notes.length,
      uncategorized: 0
    };
    for (const c of categories) out[c.id] = 0;
    for (const n of notes) {
      if (!n.categoryId) {
        out.uncategorized++;
      } else if (out[n.categoryId] !== undefined) {
        out[n.categoryId]++;
      }
    }
    return out;
  }, [notes, categories]);

  // Chip-strip ordering: categories with notes come first, sorted by
  // count descending (most-populated first); empty categories trail
  // alphabetically. "All" and "Add" chips stay at the strip's edges.
  const sortedChipCategories = useMemo(
    () =>
      [...categories].sort((a, b) => {
        const ca = counts[a.id] ?? 0;
        const cb = counts[b.id] ?? 0;
        if (ca !== cb) return cb - ca;
        return a.name.localeCompare(b.name);
      }),
    [categories, counts]
  );

  // -------- persistence (live localStorage + idle-debounce + ceiling-throttle PUT) --------
  const flushSave = async () => {
    const pending = latestSaveRef.current;
    if (!pending) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    const { noteId, draft } = pending;
    setSaveStatus("saving");
    try {
      const updated = await api.put<ApiNote>(`/job-tracker/notes/${noteId}`, {
        title: draft.title,
        content: draft.body,
        pinned: notes.find((n) => n.id === noteId)?.pinned ?? false,
        categoryId: draft.categoryId ?? undefined
      });
      clearPending(noteId);
      if (updated && updated.updatedAt) {
        baseUpdatedAtRef.current[noteId] = updated.updatedAt;
      }
      // Only mark as cleanly saved if no further keystrokes have arrived
      // since we started this PUT. If they have, queueSave has already
      // bumped status back to "editing".
      if (latestSaveRef.current?.draft === draft) {
        latestSaveRef.current = null;
      }
      setSaveStatus("saved");
      setSavedAt(new Date().toISOString());
      api.get<ApiNoteListItem[]>("/job-tracker/notes").then(setNotes).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
      setSaveStatus("error");
    }
  };

  const queueSave = (noteId: string, next: Draft) => {
    latestSaveRef.current = { noteId, draft: next };
    setSaveStatus("editing");
    // Idle debounce: reset on every keystroke.
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => void flushSave(), IDLE_DEBOUNCE_MS);
    // Ceiling throttle: only set if we're not already mid-throttle window.
    if (!throttleTimerRef.current) {
      throttleTimerRef.current = setTimeout(() => {
        throttleTimerRef.current = null;
        void flushSave();
      }, THROTTLE_MAX_MS);
    }
  };

  const updateDraft = (noteId: string, patch: Partial<Draft>) => {
    setDrafts((prev) => {
      const cur = prev[noteId] ?? { title: "", body: "", categoryId: null };
      const next = { ...cur, ...patch };
      // Mirror to localStorage immediately. This is the cheap insurance
      // that survives tab close, refresh, or kernel panic — the debounced
      // PUT will catch up in 25s, but the disk write happens now.
      const baseAt =
        baseUpdatedAtRef.current[noteId] ||
        notes.find((n) => n.id === noteId)?.updatedAt ||
        new Date().toISOString();
      writePending(noteId, {
        title: next.title,
        body: next.body,
        categoryId: next.categoryId,
        baseUpdatedAt: baseAt,
        savedAt: new Date().toISOString(),
        deviceId: getDeviceId()
      });
      queueSave(noteId, next);
      return { ...prev, [noteId]: next };
    });
  };

  // -------- history --------
  const getHistory = (noteId: string): History => {
    let h = historyRef.current[noteId];
    if (!h) {
      h = { past: [], future: [], lastPushAt: 0 };
      historyRef.current[noteId] = h;
    }
    return h;
  };

  const recordSnapshot = (noteId: string, prevValue: string, source: "typing" | "action") => {
    const h = getHistory(noteId);
    const now = Date.now();
    const coalesce = source === "typing" && now - h.lastPushAt < 600 && h.past.length > 0;
    if (!coalesce) {
      h.past.push(prevValue);
      if (h.past.length > 200) h.past.shift();
      bumpHistory((v) => v + 1);
    }
    h.future = [];
    h.lastPushAt = now;
  };

  const setBody = (noteId: string, newBody: string, source: "typing" | "action") => {
    const cur = drafts[noteId]?.body ?? "";
    if (cur === newBody) return;
    recordSnapshot(noteId, cur, source);
    updateDraft(noteId, { body: newBody });
  };

  const performUndo = () => {
    if (!activeNote) return;
    const h = getHistory(activeNote.id);
    if (h.past.length === 0) return;
    const prev = h.past.pop()!;
    h.future.push(drafts[activeNote.id]?.body ?? "");
    h.lastPushAt = 0;
    updateDraft(activeNote.id, { body: prev });
    bumpHistory((v) => v + 1);
    requestAnimationFrame(() => bodyRef.current?.focus());
  };

  const performRedo = () => {
    if (!activeNote) return;
    const h = getHistory(activeNote.id);
    if (h.future.length === 0) return;
    const next = h.future.pop()!;
    h.past.push(drafts[activeNote.id]?.body ?? "");
    h.lastPushAt = 0;
    updateDraft(activeNote.id, { body: next });
    bumpHistory((v) => v + 1);
    requestAnimationFrame(() => bodyRef.current?.focus());
  };

  const canUndo = activeNote ? (historyRef.current[activeNote.id]?.past.length ?? 0) > 0 : false;
  const canRedo = activeNote ? (historyRef.current[activeNote.id]?.future.length ?? 0) > 0 : false;

  // -------- markdown insertion --------
  const applyEdit = (
    transform: (sel: string, full: string, start: number, end: number) => {
      next: string;
      selStart: number;
      selEnd: number;
    }
  ) => {
    if (!activeNote || !draft) return;
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = draft.body.slice(start, end);
    const { next, selStart, selEnd } = transform(sel, draft.body, start, end);
    setBody(activeNote.id, next, "action");
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(selStart, selEnd);
    });
  };

  const wrap = (left: string, right: string = left, placeholder = "text") =>
    applyEdit((sel, full, start, end) => {
      const inner = sel || placeholder;
      const next = full.slice(0, start) + left + inner + right + full.slice(end);
      const innerStart = start + left.length;
      return { next, selStart: innerStart, selEnd: innerStart + inner.length };
    });

  const linePrefix = (prefix: string, placeholder = "") =>
    applyEdit((sel, full, start, end) => {
      const lineStart = full.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = (() => {
        const i = full.indexOf("\n", end);
        return i === -1 ? full.length : i;
      })();
      const block = full.slice(lineStart, lineEnd) || placeholder;
      const transformed = block
        .split("\n")
        .map((l) => (l.trim() ? `${prefix}${l}` : l))
        .join("\n");
      const next = full.slice(0, lineStart) + transformed + full.slice(lineEnd);
      return { next, selStart: lineStart, selEnd: lineStart + transformed.length };
    });

  const orderedList = () =>
    applyEdit((sel, full, start, end) => {
      const lineStart = full.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = (() => {
        const i = full.indexOf("\n", end);
        return i === -1 ? full.length : i;
      })();
      const block = full.slice(lineStart, lineEnd) || "item";
      const transformed = block
        .split("\n")
        .map((l, i) => (l.trim() ? `${i + 1}. ${l}` : l))
        .join("\n");
      const next = full.slice(0, lineStart) + transformed + full.slice(lineEnd);
      return { next, selStart: lineStart, selEnd: lineStart + transformed.length };
    });

  const insertCodeBlock = () =>
    applyEdit((sel, full, start, end) => {
      const inner = sel || "code";
      const block = `\n\`\`\`\n${inner}\n\`\`\`\n`;
      const next = full.slice(0, start) + block + full.slice(end);
      const innerStart = start + 5;
      return { next, selStart: innerStart, selEnd: innerStart + inner.length };
    });

  const insertLink = () =>
    applyEdit((sel, full, start, end) => {
      const url = window.prompt("Link URL", "https://") || "https://";
      const text = sel || "link text";
      const block = `[${text}](${url})`;
      const next = full.slice(0, start) + block + full.slice(end);
      return { next, selStart: start + 1, selEnd: start + 1 + text.length };
    });

  // -------- CRUD --------
  const createNote = async () => {
    try {
      const created = await api.post<ApiNote>("/job-tracker/notes", {
        title: "",
        content: "",
        pinned: false,
        categoryId: activeCategoryId === "all" ? undefined : activeCategoryId
      });
      await refresh();
      setActiveNoteId(created.id);
      setTimeout(() => titleRef.current?.focus(), 50);
    } catch (e) {
      window.alert(`Create failed: ${(e as Error).message}`);
    }
  };

  const togglePin = async () => {
    if (!activeNote || !draft) return;
    try {
      await api.put(`/job-tracker/notes/${activeNote.id}`, {
        title: draft.title,
        content: draft.body,
        pinned: !activeNote.pinned,
        categoryId: draft.categoryId ?? undefined
      });
      await refresh();
    } catch (e) {
      window.alert(`Update failed: ${(e as Error).message}`);
    }
  };

  const deleteNote = async () => {
    if (!activeNote) return;
    if (!window.confirm("Delete this note?")) return;
    try {
      await api.delete(`/job-tracker/notes/${activeNote.id}`);
      const droppedId = activeNote.id;
      setActiveNoteId(null);
      delete historyRef.current[droppedId];
      setDrafts((d) => {
        const copy = { ...d };
        delete copy[droppedId];
        return copy;
      });
      await refresh();
    } catch (e) {
      window.alert(`Delete failed: ${(e as Error).message}`);
    }
  };

  const addCategory = async () => {
    const name = window.prompt("New category name");
    if (!name?.trim()) return;
    const color = PALETTE[categories.length % PALETTE.length];
    try {
      await api.post("/job-tracker/notes/categories", { name: name.trim(), color });
      await refresh();
    } catch (e) {
      window.alert(`Create failed: ${(e as Error).message}`);
    }
  };

  // -------- keyboard --------
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const meta = e.metaKey || e.ctrlKey;
    if (!meta) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) {
      e.preventDefault();
      performUndo();
      return;
    }
    if ((k === "z" && e.shiftKey) || k === "y") {
      e.preventDefault();
      performRedo();
      return;
    }
    if (k === "b") {
      e.preventDefault();
      wrap("**", "**", "bold");
    } else if (k === "i") {
      e.preventDefault();
      wrap("*", "*", "italic");
    } else if (k === "k") {
      e.preventDefault();
      insertLink();
    }
  };

  // Page-leaving safety net — when the tab is hidden or about to close,
  // flush any pending draft *now* via the same PUT path. localStorage
  // already has the latest content (we mirror on every keystroke), so
  // this is just a best-effort attempt to skip the next-mount reconcile
  // round-trip if the network is still up.
  useEffect(() => {
    const flushNow = () => {
      const pending = latestSaveRef.current;
      if (!pending) return;
      // Cancel pending timers; we're going to flush right now.
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      // Fire and (intentionally) forget — the tab is leaving.
      void flushSave();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    window.addEventListener("beforeunload", flushNow);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", flushNow);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [notes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPageKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const k = e.key.toLowerCase();
      if (k === "n") {
        e.preventDefault();
        void createNote();
      } else if (k === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onPageKey);
    return () => window.removeEventListener("keydown", onPageKey);
  }, [activeCategoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const body = draft?.body ?? "";
  const charCount = body.length;
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;

  const activeChip = activeNote
    ? categories.find((c) => c.id === (draft?.categoryId ?? activeNote.categoryId)) ?? null
    : null;

  return (
    <ProductFrame active="notes" noPadding>
      {error ? (
        <div className="nx-error" role="alert">
          <em>{error}</em>
          <button
            type="button"
            className="nx-error-close"
            aria-label="Dismiss"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      ) : null}
      {conflicts.length > 0 ? (
        <div className="nx-conflicts" role="alert">
          {conflicts.map((c) => (
            <div className="nx-conflict-row" key={c.noteId}>
              <div className="nx-conflict-text">
                <strong>“{c.local.title || "Untitled"}”</strong>
                <span>
                  was changed on another device since you last edited it. Pick which version to
                  keep.
                </span>
              </div>
              <div className="nx-conflict-actions">
                <button
                  type="button"
                  className="nx-btn-secondary"
                  onClick={() => resolveKeepTheirs(c)}
                >
                  Use theirs
                </button>
                <button
                  type="button"
                  className="nx-btn-primary"
                  onClick={() => resolveKeepMine(c)}
                >
                  Keep mine
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <section className={activeNote ? "nx-workspace is-editing" : "nx-workspace"}>
        {/* CATEGORIES */}
        <aside className="nx-categories">
          <header className="nx-section-head">
            <span>CATEGORIES</span>
            <button type="button" className="nx-icon-btn" aria-label="Add category" onClick={addCategory}>
              <PlusIcon width={14} height={14} />
            </button>
          </header>
          <nav className="nx-cat-list">
            <button
              type="button"
              className={activeCategoryId === "all" ? "nx-cat is-active" : "nx-cat"}
              onClick={() => setActiveCategoryId("all")}
            >
              <span className="nx-cat-label">
                <BookOpenIcon width={14} height={14} />
                <span>All notes</span>
              </span>
              <span className="nx-cat-count">{counts.all ?? 0}</span>
            </button>
            <button
              type="button"
              className={activeCategoryId === "uncategorized" ? "nx-cat is-active" : "nx-cat"}
              onClick={() => setActiveCategoryId("uncategorized")}
            >
              <span className="nx-cat-label">
                <span className="nx-dot" style={{ background: "#8c8984" }} />
                <span>Uncategorized</span>
              </span>
              <span className="nx-cat-count">{counts.uncategorized ?? 0}</span>
            </button>
            {sortedChipCategories.map((c) => {
              const count = counts[c.id] ?? 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={
                    (activeCategoryId === c.id ? "nx-cat is-active" : "nx-cat") +
                    (count === 0 ? " is-empty" : "")
                  }
                  onClick={() => setActiveCategoryId(c.id)}
                >
                  <span className="nx-cat-label">
                    <span className="nx-dot" style={{ background: c.color || "#9094ff" }} />
                    <span>{c.name}</span>
                  </span>
                  <span className="nx-cat-count">{count}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile-only horizontal chip strip — sits ABOVE both the list
            and the editor at narrow widths so it's reachable from either
            view. CSS hides it on desktop where the dedicated categories
            rail is visible. */}
        <div className="nx-cats-strip" role="tablist" aria-label="Categories">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategoryId === "all"}
            className={
              activeCategoryId === "all" ? "nx-cats-chip is-active" : "nx-cats-chip"
            }
            onClick={() => setActiveCategoryId("all")}
          >
            <BookOpenIcon width={12} height={12} />
            <span>All</span>
            <span className="nx-cats-count">{counts.all ?? 0}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategoryId === "uncategorized"}
            className={
              (activeCategoryId === "uncategorized"
                ? "nx-cats-chip is-active"
                : "nx-cats-chip") + ((counts.uncategorized ?? 0) === 0 ? " is-empty" : "")
            }
            onClick={() => setActiveCategoryId("uncategorized")}
          >
            <span className="nx-dot" style={{ background: "#8c8984" }} />
            <span>Uncategorized</span>
            <span className="nx-cats-count">{counts.uncategorized ?? 0}</span>
          </button>
          {sortedChipCategories.map((c) => {
            const count = counts[c.id] ?? 0;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={activeCategoryId === c.id}
                className={
                  (activeCategoryId === c.id ? "nx-cats-chip is-active" : "nx-cats-chip") +
                  (count === 0 ? " is-empty" : "")
                }
                onClick={() => setActiveCategoryId(c.id)}
              >
                <span className="nx-dot" style={{ background: c.color || "#9094ff" }} />
                <span>{c.name}</span>
                <span className="nx-cats-count">{count}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="nx-cats-chip nx-cats-chip--add"
            aria-label="Add category"
            onClick={addCategory}
          >
            <PlusIcon width={12} height={12} />
            <span>Add</span>
          </button>
        </div>

        {/* NOTES LIST */}
        <aside className="nx-list">
          <button
            type="button"
            className="nx-help"
            onClick={() =>
              window.alert(
                "Markdown supported: # heading, **bold**, *italic*, `code`, ```fenced```, > quote, - / 1. lists, [link](url).\n\nShortcuts: ⌘B / ⌘I / ⌘K formatting · ⌘Z / ⌘⇧Z undo·redo · ⌘N new note · ⌘F search."
              )
            }
          >
            <BookOpenIcon width={14} height={14} />
            <span>How to use Notes</span>
          </button>
          <div className="nx-search">
            <SearchIcon width={14} height={14} />
            <input
              ref={searchRef}
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="button" className="nx-new" onClick={createNote}>
            <PlusIcon width={14} height={14} /> New note
          </button>
          <div className="nx-notes" role="list">
            {filteredNotes.length === 0 ? (
              <p className="nx-empty-list">No notes yet.</p>
            ) : (
              filteredNotes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={activeNoteId === n.id ? "nx-note-row is-active" : "nx-note-row"}
                  onClick={() => setActiveNoteId(n.id)}
                >
                  <strong>{n.title || "Untitled"}</strong>
                  <span>{fmtRelative(n.updatedAt)}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* EDITOR */}
        <div className={activeNote ? "nx-editor" : "nx-editor is-empty"}>
          {!activeNote || !draft ? (
            <div className="nx-empty-msg">Select a note from the left, or start a new one.</div>
          ) : (
            <>
              <header className="nx-editor-head">
                <button
                  type="button"
                  className="nx-back"
                  onClick={() => setActiveNoteId(null)}
                  aria-label="Back to notes"
                >
                  <ChevronLeft width={14} height={14} />
                </button>
                <CategoryPicker
                  categories={categories}
                  value={draft.categoryId}
                  current={activeChip}
                  onChange={(id) => updateDraft(activeNote.id, { categoryId: id })}
                />
                <div className="nx-head-spacer" />
                <div className="nx-modes" role="tablist" aria-label="View mode">
                  <button
                    type="button"
                    title="Edit"
                    aria-label="Edit"
                    className={viewMode === "edit" ? "nx-mode is-active" : "nx-mode"}
                    onClick={() => setViewMode("edit")}
                  >
                    <PencilIcon width={14} height={14} />
                  </button>
                  <button
                    type="button"
                    title="Split"
                    aria-label="Split"
                    className={viewMode === "split" ? "nx-mode is-active" : "nx-mode"}
                    onClick={() => setViewMode("split")}
                  >
                    <SplitIcon width={14} height={14} />
                  </button>
                  <button
                    type="button"
                    title="Preview"
                    aria-label="Preview"
                    className={viewMode === "preview" ? "nx-mode is-active" : "nx-mode"}
                    onClick={() => setViewMode("preview")}
                  >
                    <EyeIcon width={14} height={14} />
                  </button>
                </div>
                <button
                  type="button"
                  aria-label={activeNote.pinned ? "Unpin" : "Pin"}
                  title={activeNote.pinned ? "Unpin" : "Pin"}
                  className={activeNote.pinned ? "nx-icon-btn is-active" : "nx-icon-btn"}
                  onClick={togglePin}
                >
                  <PinIcon width={14} height={14} />
                </button>
                <button
                  type="button"
                  aria-label="Delete"
                  title="Delete"
                  className="nx-icon-btn"
                  onClick={deleteNote}
                >
                  <TrashIcon width={14} height={14} />
                </button>
              </header>

              <input
                ref={titleRef}
                className="nx-title"
                placeholder="Note title"
                value={draft.title}
                onChange={(e) => updateDraft(activeNote.id, { title: e.target.value })}
              />
              <p className="nx-meta">Last edited {fmtRelative(activeNote.updatedAt)}</p>

              {viewMode !== "preview" ? (
                <div className="nx-toolbar" role="toolbar" aria-label="Formatting">
                  <button
                    className="nx-tool"
                    type="button"
                    title="Undo (⌘Z)"
                    aria-label="Undo"
                    onClick={performUndo}
                    disabled={!canUndo}
                  >
                    <UndoIcon width={14} height={14} />
                  </button>
                  <button
                    className="nx-tool"
                    type="button"
                    title="Redo (⌘⇧Z)"
                    aria-label="Redo"
                    onClick={performRedo}
                    disabled={!canRedo}
                  >
                    <RedoIcon width={14} height={14} />
                  </button>
                  <span className="nx-divider" aria-hidden="true" />
                  <button className="nx-tool" type="button" title="Heading 1" onClick={() => linePrefix("# ", "Heading")}>
                    H1
                  </button>
                  <button className="nx-tool" type="button" title="Heading 2" onClick={() => linePrefix("## ", "Heading")}>
                    H2
                  </button>
                  <button className="nx-tool" type="button" title="Heading 3" onClick={() => linePrefix("### ", "Heading")}>
                    H3
                  </button>
                  <span className="nx-divider" aria-hidden="true" />
                  <button className="nx-tool nx-tool--bold" type="button" title="Bold (⌘B)" onClick={() => wrap("**", "**", "bold")}>
                    B
                  </button>
                  <button className="nx-tool nx-tool--italic" type="button" title="Italic (⌘I)" onClick={() => wrap("*", "*", "italic")}>
                    I
                  </button>
                  <button className="nx-tool" type="button" title="Inline code" aria-label="Inline code" onClick={() => wrap("`", "`", "code")}>
                    <CodeIcon width={12} height={12} />
                  </button>
                  <button className="nx-tool" type="button" title="Code block" aria-label="Code block" onClick={insertCodeBlock}>
                    {"{ }"}
                  </button>
                  <button className="nx-tool nx-tool--quote" type="button" title="Quote" onClick={() => linePrefix("> ", "quote")}>
                    “
                  </button>
                  <span className="nx-divider" aria-hidden="true" />
                  <button className="nx-tool" type="button" title="Bulleted list" aria-label="Bulleted list" onClick={() => linePrefix("- ", "item")}>
                    •
                  </button>
                  <button className="nx-tool" type="button" title="Numbered list" aria-label="Numbered list" onClick={orderedList}>
                    1.
                  </button>
                  <button className="nx-tool" type="button" title="Link (⌘K)" aria-label="Link" onClick={insertLink}>
                    ↗
                  </button>
                </div>
              ) : null}

              <div className={`nx-pane mode-${viewMode}`}>
                {viewMode !== "preview" ? (
                  <textarea
                    ref={bodyRef}
                    className="nx-body"
                    placeholder="Start writing... (Markdown supported)"
                    value={draft.body}
                    onChange={(e) => setBody(activeNote.id, e.target.value, "typing")}
                    onKeyDown={handleKeyDown}
                  />
                ) : null}
                {viewMode !== "edit" ? (
                  <div
                    className="nx-preview markdown-body"
                    dangerouslySetInnerHTML={{
                      __html:
                        renderMarkdown(draft.body) ||
                        '<p style="font-style:italic;color:#7d7c76">Nothing to preview yet.</p>'
                    }}
                  />
                ) : null}
              </div>

              <footer className="nx-status">
                <span>
                  {charCount} chars · {wordCount} words
                </span>
                <span className={`nx-save-status nx-save-${saveStatus}`}>
                  {saveStatus === "editing" ? "Editing… · saves in 15s" : null}
                  {saveStatus === "saving" ? "Saving…" : null}
                  {saveStatus === "error" ? "Save failed · keep typing to retry" : null}
                  {saveStatus === "saved" || saveStatus === "idle"
                    ? savedAt
                      ? `Saved · ${new Date(savedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}`
                      : "Saved"
                    : null}
                </span>
              </footer>
            </>
          )}
        </div>
      </section>
    </ProductFrame>
  );
}

function CategoryPicker({
  categories,
  value,
  current,
  onChange
}: {
  categories: ApiCategory[];
  value: string | null;
  current: ApiCategory | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="nx-cat-picker">
      <button type="button" className="nx-chip" onClick={() => setOpen((v) => !v)}>
        <span className="nx-dot" style={{ background: current?.color ?? "#8c8984" }} />
        <span>{current?.name ?? "Uncategorized"}</span>
        <ChevronDown width={12} height={12} />
      </button>
      {open ? (
        <>
          {/* Backdrop — hidden on desktop, becomes a tap-out overlay on
              mobile where the menu opens as a centered popup. */}
          <button
            type="button"
            className="nx-cat-backdrop"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="nx-cat-menu" role="menu">
            <header className="nx-cat-menu-head">
              <span>Move to category</span>
              <button
                type="button"
                className="nx-cat-menu-close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <button
              type="button"
              className={value === null ? "nx-cat-menu-item is-active" : "nx-cat-menu-item"}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <span className="nx-dot" style={{ background: "#8c8984" }} />
              <span>Uncategorized</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={value === c.id ? "nx-cat-menu-item is-active" : "nx-cat-menu-item"}
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
              >
                <span className="nx-dot" style={{ background: c.color || "#9094ff" }} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
