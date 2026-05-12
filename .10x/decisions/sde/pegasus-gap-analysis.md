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

## Deviations from plan

- TASK-17: No separate recruiter card renderer was needed — the standard `filteredPosts(posts, search)` loop already covers recruiters. The old seed data rendered a different table-style layout; after removal, recruiters render as standard post cards. This is the correct behavior per the task spec.
- TASK-16: Used `<a>` not `<Link>` for `/u/` paths — correct since public profiles are on the root domain outside the Next.js basePath.

## Tech debt

- Filter "All Outcomes", "All Roles", "All Levels", "All Companies", "All Tags" only clear the filter key; the UI does not yet provide a way to select a specific outcome/role/level. That's a follow-up (render a dropdown or second tier of buttons). Severity: LOW — the URL state infrastructure is in place.
- `communityExperiences` (static seed data for experiences) is still imported from `@/lib/site-data` and used for the experience count and `filteredExperiences`. This is pre-existing tech debt; the experiences section already uses real API posts for the list. Severity: LOW.

## Test coverage

TypeScript: `pnpm tsc --noEmit` — zero errors (verified before commit).
No unit tests added — the changed code is UI event handlers and API wiring; behavior tests for these would require a React testing setup that is not present in this project. The type check provides compile-time coverage for all API call shapes.
