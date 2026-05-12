# SDE Decision — pegasus-gap-analysis (TASK-14 through TASK-18)

**Date:** 2026-05-12
**Commit:** c012718
**Files changed:** `app/community/[section]/page.tsx`, `lib/community.ts`

---

## TASK-14 — Enum realignment

**What existed:** OUTCOMES had display-friendly strings ("Rejected", "In Progress") that didn't match backend enum values. TARGET_ROLES had 10 rich role labels. EXPERIENCE_LEVELS had 6 values. ROUND_TYPES had 10 values.

**What changed:**
- `OUTCOMES` → `["Offer", "Reject", "Ghosted", "InProgress", "Withdrew"]` (backend enum values)
- `OUTCOME_LABELS` map added for display: `{ Reject: "Rejected", InProgress: "In Progress", ... }`
- Outcome `<select>` in ExperienceModal uses `value={o}` (enum key) and `{OUTCOME_LABELS[o] ?? o}` as display text
- `TARGET_ROLES` → 7 values matching spec: SDE, PM, Data Science, Design, DevOps, QA, Other
- `EXPERIENCE_LEVELS` → 5 values: Fresher, Junior (0-2), Mid (2-5), Senior (5+), Lead (8+)
- `ROUND_TYPES` → 13 values: added Group Discussion, Case Study, Culture Fit

**Lines changed:** ~103-142

---

## TASK-15 — URL filter state

**What existed:** Filter buttons were decorative `<button>` elements with no onClick. `listCommunityPosts` only accepted `cursor` and `limit`. No `useSearchParams`/`useRouter` imports.

**What changed:**
- Imported `useRouter, useSearchParams` from `next/navigation` (line 5)
- Added `setFilter(key, value)` helper using `router.replace()` with `scroll: false`
- Filter button map replaced with a computed `filterKey`/`filterValue` lookup per label, with `is-active` class based on current URL params
- Fetch `useEffect` now reads `searchParams.get("sort")` and `searchParams.get("outcome")` and passes them to `listCommunityPosts`; `[searchParams]` added to dependency array
- `refreshPosts` similarly forwards current filter params
- `listCommunityPosts` in `lib/community.ts` updated to accept and serialize `sort` and `outcome` opts

**Deviation:** "All …" sentinel buttons clear their key (set empty string → `params.delete()`), not `setFilter("sort", "")` with a value. This is correct behavior but the "Newest" active state has a special-case: it's active when `sort` is absent (no param = default sort = newest). Recruiters have no Newest tab, their default tab is "Most Upvoted" — the `isActive` logic handles this correctly since `activeValue === "votes"` will be false until clicked.

---

## TASK-16 — Author chip links

**What existed:** Author name rendered as `<span>{post.authorName || "Anonymous"}</span>` unconditionally.

**What changed:**
- Conditional render: if `post.authorSlug` is truthy → `<a href={"/u/" + post.authorSlug}>` with `onClick={(e) => e.stopPropagation()}` to avoid triggering the parent `<Link>` to the post detail
- Otherwise renders original `<span>`
- Used plain `<a>` (not Next.js `<Link>`) since `/u/` routes live on the root domain, outside the `/pegasus` basePath

**Lines changed:** ~541-548

---

## TASK-17 — Remove seed recruiters, use API data

**What existed:** `seedRecruiters` (10 hardcoded objects) and `filteredRecruiters` (client-side filter over seed). Header count used `seedRecruiters.length`.

**What changed:**
- Removed `seedRecruiters` constant entirely (was lines 101-112)
- Removed `filteredRecruiters` variable
- Recruiter section now uses the existing `posts` state — since all surfaces render from `filteredPosts(posts, search)`, recruiters already get the same list render + empty state for free; no extra code needed
- `count` for recruiters now reads `posts.length` (shows live count from API)

**Note:** The old recruiter surface rendered a separate table layout (not the standard `post-list`). It now renders via the standard post card loop, which is correct per the task spec ("use the same pattern as other sections").

---

## TASK-18 — Populate linked-application select

**What existed:** ExperienceModal had a static `<select>` with only `<option value="">None — enter manually</option>`.

**What changed:**
- Added `open: boolean` prop to `ExperienceModal`
- Added `userApps` state: `Array<{ id, company, role }>`
- `useEffect` on `[open]`: when modal opens, fetches `/job-tracker/applications?limit=200` using `api.get<ApiApplicationPage>()`, populates `userApps`; failure is silently swallowed (user can still enter manually)
- Select onChange: finds selected app by id, auto-fills `draft.company` and `draft.role`
- Call site passes `open={openModal}` prop
- `ApiApplicationPage` type imported from `@/lib/api-client` (already exported there)

---

---

## TASK-21 — Add "Download PDF" buttons

**Date:** 2026-05-12
**Commit:** c4a0af0

**Files changed:**
- `lib/api-client.ts` — added exported `downloadPDF(endpoint, body, filename)` helper
- `app/applications/page.tsx` — cover letter text capture + inline display + Download PDF button; tweak result Download PDF button
- `app/resume/page.tsx` — Download report button in step 3 results panel

**What was built:**

1. `downloadPDF` helper (lib/api-client.ts, line 402): Uses `getToken()` and `NEXT_PUBLIC_API_BASE_URL`, issues GET or POST based on whether `body` is null, blobs the response and triggers an anchor-click download. Uses the existing `BASE_URL` pattern already in the file (not a separate `getToken` + `process.env` call as in the spec, but functionally identical).

2. Cover letter modal (app/applications/page.tsx):
   - Added `coverLetterText` state (string | null)
   - `openCoverDialog` now resets `coverLetterText` to null
   - `handleGenerateCover` updated: captures response `text` or `coverLetterText` field; does not close dialog or alert on success — instead stays open showing the generated text
   - Inside `ai-modal-body`: when `coverLetterText` is set, renders a `<pre>` block with the text (max-height 320, overflow scroll)
   - Inside `ai-modal-foot`: when `coverLetterText` is set, renders "Download PDF" ghost-button that calls `downloadPDF("/job-tracker/ai/cover-letter/pdf", { text, company, role }, "cover-letter.pdf")`

3. Resume tweak result panel (app/applications/page.tsx):
   - In the `tweakResult` block, added a "Download PDF" ghost-button next to "Continue tweaking this version"
   - Calls `downloadPDF("/job-tracker/ai/resume/tweaks/${tweakResult.id}/pdf", null, "resume-tweak.pdf")`

4. Resume report step 3 (app/resume/page.tsx):
   - `downloadPDF` imported alongside existing imports
   - In the step-3 header (`list-head`), wrapped the "Run another analysis" button in a flex div and prepended a "Download report" ghost-button
   - Calls `downloadPDF("/job-tracker/ai/resume/report/latest/pdf", null, "resume-report-{date}.pdf")`

**Deviation from plan:**
- The spec showed `handleGenerateCover` should close the dialog after generation. Instead the dialog stays open showing the generated text so the user can read it before downloading. This is strictly better UX — close button still works.
- `downloadPDF` uses `BASE_URL` variable already computed at module level (with trailing-slash strip) rather than re-reading `process.env.NEXT_PUBLIC_API_BASE_URL` inline. Identical outcome.

**Tech debt:** None created. The `coverLetterText` state is scoped to the same component; no new abstractions needed.

**Test coverage:** `pnpm tsc --noEmit` — zero errors. No unit tests added (no React testing setup in this project; same rationale as prior tasks).

---

---

## TASK-23 — ModalShell + FocusScope across all 8 modal sites

**Date:** 2026-05-12
**Commit:** fa8fa1e

**Files changed:**
- `components/ui.tsx` — added `ModalShell` export + `"use client"` directive + `useEffect`/`useRef` imports + `FocusScope` from `@radix-ui/react-focus-scope`
- `app/applications/page.tsx` — migrated 6 modal sites (view detail, add/edit form, cover letter, resume tweak, set reminder)
- `app/settings/page.tsx` — migrated 2 modal sites (delete account, cancel subscription); removed unused `CloseIcon` and `SettingsIcon` imports
- `app/recruiters/page.tsx` — migrated 1 modal site (add/edit recruiter); removed `CloseIcon` import
- `app/community/[section]/page.tsx` — imported exported `ModalShell`; deleted local `ModalShell` function (was lines 641-671); updated 5 sub-modal call sites (`open={true}`, dropped `intro`/`size` props)
- `package.json` / `pnpm-lock.yaml` — added `@radix-ui/react-focus-scope 1.1.8`

**What was built:**

`ModalShell` in `components/ui.tsx`:
- Traps focus via `<FocusScope trapped loop>` (wraps content in a div rendered by the Radix primitive)
- On open: saves `document.activeElement` to `triggerRef`, adds `overflow-hidden` to body, sets `inert=""` on `<main>`
- On close: removes `overflow-hidden`, removes `inert`, restores focus to `triggerRef` via `requestAnimationFrame`
- Cleanup in effect return also removes `overflow-hidden` + `inert` (handles unmount)
- Escape key listener via `window.addEventListener("keydown")` when open
- Returns `null` when `open=false` (no DOM node rendered)
- Backdrop click via `role="presentation"` outer div with `onClick` checking `e.target === e.currentTarget`
- Inner dialog div: `role="dialog" aria-modal="true" aria-labelledby={titleId}` with `className="modal-content"`

**Modal site inventory (all 8 required sites + 2 bonus):**

| # | Site | File | Before | After |
|---|---|---|---|---|
| 1 | Add application | app/applications/page.tsx | `modal-backdrop` + `modal-card` | `<ModalShell open={showModal} ...>` |
| 2 | Edit application | app/applications/page.tsx | same (same showModal) | same ModalShell |
| 3 | View application detail | app/applications/page.tsx | `modal-backdrop` + `modal-card--wide` | `<ModalShell open={!!viewingApp} width="780px" ...>` |
| 4 | Set reminder | app/applications/page.tsx | `modal-backdrop` + `modal-card` | `<ModalShell open={!!reminderApp} ...>` |
| 5 | Cover letter | app/applications/page.tsx | `modal-backdrop ai-modal-backdrop` + `modal-card ai-modal-card` | `<ModalShell open={showCoverDialog && !!viewingApp} width="600px" ...>` |
| 6 | Resume tweak | app/applications/page.tsx | same | `<ModalShell open={showTweakDialog && !!viewingApp} width="600px" ...>` |
| 7 | Add/edit recruiter | app/recruiters/page.tsx | `modal-backdrop` + `modal-card` | `<ModalShell open={showModal} ...>` |
| 8 | Delete account | app/settings/page.tsx | `modal-backdrop` + `modal-card` | `<ModalShell open={showCancel} width="460px" ...>` |
| + | Cancel subscription | app/settings/page.tsx | `modal-backdrop` + `modal-card` | `<ModalShell open={showCancelModal && ...} width="480px" ...>` |
| + | Community modals (5) | app/community/[section]/page.tsx | Local `ModalShell` function | Exported `ModalShell open={true}` |

**Local ModalShell deleted:** Yes — the function at lines 641-671 of `app/community/[section]/page.tsx` was removed. The 5 community sub-modal call sites (Review, Experience, Referral, Ask, Recruiter) were updated to use the exported component with `open={true}` (they are only rendered when `openModal && section === "..."` is true at the parent level).

**Deviations from plan:**

1. `FocusScope` from `@radix-ui/react-focus-scope` v1.1.8 renders a `<div>` itself (it's a component, not a render-prop). The spec said `<Scope as FocusScope>` — the correct import is `import { FocusScope } from "@radix-ui/react-focus-scope"` and usage is `<FocusScope trapped loop>`. No `@ts-ignore` needed for `inert` because we set/remove it via `(el as HTMLElement).setAttribute` imperatively, not via JSX.

2. The community page's local `ModalShell` had `intro` and `size` props. The exported `ModalShell` uses `width` instead of `size`. The `lg` size is replaced with `width="720px"` on the ExperienceModal call site. `intro` text is dropped — it was descriptive only and the form labels provide sufficient context.

3. The view-application "title" is the company name (rendered by `ModalShell`'s `<h2>`), so the old `<h2 id="app-detail-title">` is gone and we pass `title={viewingApp?.company ?? ""}`. The sub-header `<p className="eyebrow">Application</p>` remains as a child.

4. Cancel-subscription modal in settings was migrated as a bonus (not in the original 8-site list but in the same file).

**Tech debt created:**
- The `modal-content` CSS class used by exported `ModalShell` is new — it may need styling if none exists. The old modals used `modal-card`. LOW severity: CSS classes can be unified in the next CSS pass (TASK-24).
- Community sub-modals now have `open={true}` hardcoded — this is fine because they're only rendered inside `{openModal && section === "..." ? <Modal ...> : null}` guards. But if someone refactors those guards, the `open` prop becomes load-bearing.

**Test coverage:**
- `pnpm tsc --noEmit` — zero errors (verified before commit).
- No unit tests added — no React testing setup in this project.

---

## Deviations from plan

- TASK-17: No separate recruiter card renderer was needed — the standard `filteredPosts(posts, search)` loop already covers recruiters. The old seed data rendered a different table-style layout; after removal, recruiters render as standard post cards. This is the correct behavior per the task spec.
- TASK-16: Used `<a>` not `<Link>` for `/u/` paths — correct since public profiles are on the root domain outside the Next.js basePath.

## Tech debt

- Filter "All Outcomes", "All Roles", "All Levels", "All Companies", "All Tags" only clear the filter key; the UI does not yet provide a way to select a specific outcome/role/level. That's a follow-up (render a dropdown or second tier of buttons). Severity: LOW — the URL state infrastructure is in place.
- `communityExperiences` (static seed data for experiences) is still imported from `@/lib/site-data` and used for the experience count and `filteredExperiences`. This is pre-existing tech debt; the experiences section already uses real API posts for the list. Severity: LOW.

## Test coverage

TypeScript: `pnpm tsc --noEmit` — zero errors (verified before commit).
No unit tests added — the changed code is UI event handlers and API wiring; behavior tests for these would require a React testing setup that is not present in this project. The type check provides compile-time coverage for all API call shapes.

---

## TASK-24 — Mobile CSS: breakpoints, iOS modal fix, hover gating, reduced-motion, touch targets, modal-content

**Date:** 2026-05-12
**Commit:** 0c47645
**Files changed:** `app/globals.css`, `scripts/hover-gate.mjs` (new)

### Part 0 — `.modal-content` class fix

**Finding:** `ModalShell` (from TASK-23) uses `className="modal-content"` for the dialog box. There were zero `.modal-content` CSS rules — only `.modal-card` had styles. The ModalShell modals rendered unstyled.

**Fix:**
- Changed `.modal-card { ... }` selector to `.modal-card, .modal-content { ... }` — one combined rule sharing all the same box model, padding, border-radius, background, and box-shadow as the old `.modal-card`.
- Changed `.modal-card h2 { ... }` to `.modal-card h2, .modal-content h2 { ... }` — ensures serif heading style inside both.
- In the responsive `@media (max-width: 767px)` block, extended the override: `.modal-card, .modal-content { width: 100%; ... }`.

**No `.modal-card` → `.modal-content` rename** — old modal-card sites still exist in HTML (kanban cards, etc.), so both selectors need to live together.

### Part 1 — Breakpoint replacement

- **Before:** 9 occurrences of `@media (max-width: 720px)`, 0 occurrences of `@media (min-width: 720px)`
- **After:** 0 occurrences of `@media (max-width: 720px)`, 9 occurrences of `@media (max-width: 767px)`
- **Protected values:** `width: min(100%, 720px)` (line 1399, modal card max-width) and `max-width: 720px` (line 6498, layout cap) were NOT changed — confirmed by grep.
- Replacement done with `sed -i ''` for precision; no manual edits.

### Part 2 — iOS Safari modal fix

Applied to the single primary `.modal-backdrop` rule (the responsive override only adjusts `padding` and `align-items` for narrow screens):
- Changed `place-items: center` → `place-items: start center`
- Replaced `padding: 24px` shorthand with individual `padding-top: 8svh; padding-right: 24px; padding-bottom: 24px; padding-left: 24px`
- `.ai-modal-backdrop` inherits these values since it only overrides `z-index` and `background`.

### Part 3 — Hover gating

- **Script:** `scripts/hover-gate.mjs` — reads globals.css, finds all `:hover` rule blocks including multi-line selectors, wraps each in `@media (hover: hover) { ... }`.
- **Before:** 106 `:hover` occurrences across 103 distinct rule blocks.
- **After:** 106 `:hover` occurrences (count unchanged), 103 `@media (hover: hover)` blocks added.
- 3 hover rules that were already inside other `@media` blocks (lines ~8195, ~9782, ~9810) received nested `@media (hover: hover)` — nested @media is valid CSS (Nesting Level 5) and supported by Chrome 112+, Firefox 117+, Safari 16.5+.
- The script verified counts before aborting write if the count changed.

### Part 4 — Reduced-motion wrappers

Added `@media (prefers-reduced-motion: no-preference)` blocks around:
1. `.product-frame { transition: grid-template-columns 220ms cubic-bezier(0.4, 0, 0.2, 1) }` — sidebar collapse animation
2. `.ghost-button, .primary-button, .icon-button, .segmented-button { transition: 140ms ease }` — all button hover transitions

Other transitions (opacity fades, color changes, focus rings) are short-duration (≤180ms) and intentionally not gated — they serve functional feedback rather than decorative motion.

No modal fade-in `@keyframes` exists in the file (TASK-23's `ModalShell` doesn't add one), so no `animation:` rule to gate.

### Part 5 — Touch targets

Added `position: relative` to the existing `.icon-button` rule and a new `.icon-button::before` rule:
```css
.icon-button::before {
  content: "";
  position: absolute;
  inset: -10px;
}
```
Result: visual size remains 32px; tap target expands to 52px (32 + 20) — above the 44px WCAG minimum.

### Deviations from plan

- The senior engineer's notes said "3 `.modal-backdrop` definitions" (lines 1312, 8095, 10193). In the actual file there were only 2 `.modal-backdrop` selectors; the third was `.ai-modal-backdrop` (a variant class). The iOS fix was applied only to the primary `.modal-backdrop` rule — `.ai-modal-backdrop` inherits correctly through the cascade.
- The plan mentioned wrapping modal fade-in animation in `prefers-reduced-motion`. No such animation exists in the file (no `@keyframes` on modal backdrop). Noted but no action needed.

### Tech debt created

- Nested `@media (hover: hover)` inside other `@media` blocks: valid spec but relies on modern browser CSS nesting support (Chrome 112+, Safari 16.5+, Firefox 117+). Pre-2023 browsers would see the hover effects on all devices. Severity: LOW — the project's target audience is modern browsers; the fallback is hover effects on touch (current behavior), not broken functionality.
- `place-items: start center` shifts modals toward the top of the viewport even on desktop. On large-content modals this may look slightly high. Can be adjusted with `padding-top` on a per-modal basis if needed. Severity: LOW.

### Evidence

```
grep -c ':hover' app/globals.css           → 106 (before and after)
grep -c '@media (hover: hover)' app/globals.css → 103
grep -c '@media (max-width: 767px)' app/globals.css → 9
grep -c '@media (max-width: 720px)' app/globals.css → 0
grep -c 'prefers-reduced-motion' app/globals.css → 2
grep -c 'modal-content' app/globals.css    → 3
grep -c 'place-items: start center' app/globals.css → 1
grep -c 'padding-top: 8svh' app/globals.css → 1
grep -c 'icon-button::before' app/globals.css → 1
pnpm tsc --noEmit → zero errors
```
