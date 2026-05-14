# Resume Builder — FE component map

Module entry: `app/resume-builder/page.tsx` (Next.js route under the
`/pegasus` basePath, so the public path is `/pegasus/resume-builder`).

Architectural context lives in the backend repo:
[ADR-0008](../../../sypher-api/docs/adr/0008-resume-builder.md).

This README is a map of how the pieces fit. If you're trying to
understand a specific behavior, jump straight to the section.

---

## File layout

```
app/resume-builder/
  page.tsx                       # route shell, drafts rail, autosave, URL state

components/resume-builder/
  editor.tsx                     # split-pane host; Form ↔ LaTeX mode toggle
  preview.tsx                    # multi-page HTML preview (Form mode)
  latex-compile-preview.tsx      # PDF iframe (Form-mode opt-in + LaTeX mode default)
  export-modal.tsx               # compile → PDF iframe → save to Vault
  section-personal.tsx           # name, email, phone, location, social URLs
  section-summary.tsx            # short paragraph
  section-experiences.tsx        # repeating role cards with bullets
  section-educations.tsx         # repeating education entries
  section-skills.tsx             # repeating skill groups (category + items)
  section-projects.tsx           # repeating project cards with bullets
  section-style.tsx              # accent colour, font, density, margins, separators

lib/
  resume-builder.ts              # typed API client (drafts CRUD + render)
  resume-builder-content.ts      # emptyDraftContent, defaultStyle, fromProfile
  api-client.ts                  # shared ApiDraftContent / ApiDraftStyle / ApiResumeBuilderDraft
```

---

## Data flow

```
                   ┌──────────────────────────────────┐
                   │  app/resume-builder/page.tsx     │
                   │  ─ drafts rail (list / select)   │
                   │  ─ autosave (2 s debounce)       │
                   │  ─ URL state (?draft=<id>)       │
                   └──────────────────┬───────────────┘
                                      │  content + onChange
                                      ▼
                   ┌──────────────────────────────────┐
                   │       editor.tsx                 │
                   │   Form mode      LaTeX mode      │
                   │   ─────────────  ─────────────   │
                   │   7 section      <textarea>      │
                   │   forms          customTex       │
                   └─────┬──────────────────┬─────────┘
                         │                  │
                ┌────────▼─────┐    ┌───────▼────────┐
                │ preview.tsx  │    │ latex-compile- │
                │ (HTML, no    │    │ preview.tsx    │
                │  network)    │    │ (POST → PDF)   │
                └──────────────┘    └────────────────┘

                       Export path (both modes):
                       editor → export-modal → /render/pdf → Vault
```

---

## `editor.tsx`

Host component. Owns the mode toggle and the LaTeX source state.

- **Form mode**: renders the 7 section components in a scrollable column.
  Edits flow up through `onChange(content)` to `page.tsx`, which
  autosaves to `/resume-builder/drafts/:id`.
- **LaTeX mode**: renders a single `<textarea>` bound to
  `content.customTex`. When the user toggles into LaTeX mode for the
  first time, we synthesise the `customTex` from the current form data
  via the `/render/tex` endpoint — so they always start from the same
  thing the form would have produced.
- **Form → LaTeX**: when a Form-mode edit fires while `customTex` is
  set, we clear `customTex` (back to "form is the source of truth").
  The user is shown a small "LaTeX edits are not synced back to the
  form" hint to make this expectation explicit.
- **LaTeX → Form**: intentionally not supported (see ADR-0008 D7).
  Round-tripping arbitrary LaTeX into structured data is a parser
  problem we don't need to solve.

In Form mode there's an optional "Compiled PDF" toggle that swaps the
HTML `preview` for `latex-compile-preview` — same render path the
power user gets, but using the form-derived `.tex`.

---

## `preview.tsx`

Pure-client HTML preview, no network. Used as the default preview in
Form mode because it's instant.

The interesting bit is multi-page rendering:

```ts
const PAGE_BASE_WIDTH    = 816   // Letter @ 96 DPI
const PAGE_BASE_HEIGHT   = 1056
const PAGE_MARGIN_TOP    = 60
const PAGE_MARGIN_BOTTOM = 60
const PAGE_CONTENT_HEIGHT = PAGE_BASE_HEIGHT - PAGE_MARGIN_TOP - PAGE_MARGIN_BOTTOM
```

Approach: render the whole resume once into a hidden tall flow, measure
its height with a ref, divide by `PAGE_CONTENT_HEIGHT` to get the page
count, then emit N visible page frames where each one clips a window
into the flow via `translateY(-i * PAGE_CONTENT_HEIGHT)`.

This is intentionally NOT a real layout engine. The HTML preview won't
match the LaTeX output pixel-for-pixel at the page break — that's fine
because the LaTeX render is the authoritative one. The HTML preview is
for fast feedback on content, not pagination.

Style is wired in via CSS variables (`--rb-accent`, `--rb-font`, etc.)
sourced from `content.style`, so every form-mode style tweak is live
without re-render plumbing.

---

## `latex-compile-preview.tsx`

The on-demand PDF preview pane. Mounted in:

- LaTeX mode (it's the only preview that makes sense there)
- Form mode when the user toggles "Compiled PDF" on

Behaviour:

- Renders an empty pane with a "Compile preview" button.
- Click → POST current draft to `/resume-builder/render/pdf` → get a
  PDF blob → display in an iframe.
- After any subsequent edit, the pane is marked **stale** (faded + a
  "Source changed — recompile" pill). The user clicks the button again.
- On 503 (`latex_service_unavailable`) the pane renders a "compile
  service is offline" message instead. No retry loop — they recover by
  fixing the sidecar.
- On 4xx (`compile_failed`) the pane renders the log tail in a
  `<pre class="rb-tex-preview-log">` block.

No auto-compile-on-edit by design (ADR-0008 D10). Compiling on every
keystroke would hammer the sidecar; debouncing would feel laggy. The
button is one click and people learn the rhythm fast.

---

## `export-modal.tsx`

Same compile path as `latex-compile-preview`, but it's the user's
"I'm done, save this" exit ramp:

1. Compile current draft via `/render/pdf`.
2. Show the PDF in an iframe so the user can sanity-check.
3. On confirm, POST the bytes to `/resumes/upload` → lands in one of
   the 5 Vault slots (or the unslotted "AI Source" bucket if the user
   picks that). Reuses the existing Vault slot picker.

The modal is also where the user picks a filename (defaults to the
draft title + date stamp).

---

## Section components

All 7 follow the same shape: receive `value` + `onChange`, render
inputs, fire `onChange(updated)` on every edit. They're dumb — no
network, no validation beyond `required` on browser-native fields. The
parent page debounces autosave so per-keystroke updates aren't a
problem.

Repeating sections (`experiences`, `educations`, `skills`, `projects`)
have add/remove/reorder controls, with the array stored in
`content.<section>`.

The `section-style` component is special: it edits `content.style`,
not a content array. Each control writes a CSS variable that both
`preview.tsx` and the LaTeX template consume — kept in sync via the
field names in `DraftStyle`.

---

## API client (`lib/resume-builder.ts`)

Thin wrapper over `fetch` for:

- `listDrafts()` → `GET /resume-builder/drafts`
- `getDraft(id)` → `GET /resume-builder/drafts/:id`
- `createDraft(content)` / `updateDraft(id, content)` / `deleteDraft(id)`
- `renderTex(content, template)` → `POST /resume-builder/render/tex`
- `renderPdf(content, template)` → `POST /resume-builder/render/pdf`
- `saveToVault(content, slot, filename)` → wires render + Vault upload

`listDrafts` has a defensive `res?.items ?? []` — historically a stale
backend could return the root status object instead of the list
envelope, which crashed `drafts.length`. The guard makes the FE
resilient to that mismatch.

---

## Autosave + URL state (in `page.tsx`)

- Autosave fires 2 s after the last edit, or immediately on
  draft-switch / route-leave. Status pill shows "Saved" / "Saving…" /
  "Save failed — retry".
- The selected draft id is mirrored to the URL as `?draft=<id>` so
  refreshing keeps the user in the same draft and back/forward works.
- Empty state (no drafts) shows a "Start from your profile" CTA which
  seeds a new draft via `fromProfile(me)` in `resume-builder-content.ts`.

---

## Dedup + Strict Mode notes

This module benefits from the module-level cache + inflight pattern in
`lib/auth.ts` (and the polling singleton in `lib/notifications.ts`).
The route mounts those once via `frames.tsx`, so opening the Resume
Builder doesn't re-fetch `/me` or `/billing/me` even on rapid back/forward.

`next.config.mjs` has `reactStrictMode: false` to avoid dev-only
double-mount artefacts in autosave + draft-fetch effects. That decision
is project-wide, not specific to this module.

---

## Where to start for common changes

| Change                                              | File                              |
|-----------------------------------------------------|-----------------------------------|
| New form field (e.g. `headline`)                    | `lib/api-client.ts` (type), `section-personal.tsx`, `preview.tsx`, LaTeX template in `sypher-api` |
| New style toggle                                    | `section-style.tsx` + `preview.tsx` CSS var + LaTeX template param |
| Tweak page margins / breaks                         | Constants at top of `preview.tsx` |
| New section type                                    | New `section-*.tsx` + slot in `editor.tsx` + `DraftContent` type + LaTeX template |
| Change error UX on compile failure                  | `latex-compile-preview.tsx`       |
| Change vault slot picker behavior                   | `export-modal.tsx`                |
| Template change (new template id)                   | Template lives in `sypher-api/internal/jobtracker/templates/resume_builder/`; expose its id in the FE template dropdown if/when added |

---

## Related

- Backend: `internal/jobtracker/resume_builder_render.go`,
  `handlers_resume_builder.go`, `templates/resume_builder/classic.tex.tmpl`
- ADR: [`docs/adr/0008-resume-builder.md`](../../../sypher-api/docs/adr/0008-resume-builder.md)
- Sidecar runbook: [`docs/sypher-tex.md`](../../../sypher-api/docs/sypher-tex.md)
