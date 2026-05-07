# Pegasus

> A calmer way to job hunt. Pipeline tracking, public profiles, AI resume reviews, notes, and a browser clipper — wired to `sypher-api`.
>
> by Shubham

## What's here

- Marketing homepage, login, blog index + articles
- Community hub (reviews, experiences, referrals, ask, recruiters)
- Authenticated product surface: dashboard, applications, notes, profile, resume vault, AI resume reports, settings
- Public profile pages at `/u/[slug]`

## How it's wired

- Frontend: Next.js 14 (App Router) on `localhost:3000` in dev
- Backend: `sypher-api` (Go monolith) on `localhost:8000` in dev, `api.sypher.in` in prod — see `../sypher-api/docs/TOOL_PLAYBOOK.md`
- Auth: Google OAuth → JWT in `localStorage`, sent as `Authorization: Bearer …`
- Files: Cloudflare R2, browser-direct upload via presigned URLs
- AI: Deepseek (resume report + cover letter)

## Run locally

```bash
npm install
npm run dev
```

`sypher-api` must be running on `:8000` for any authenticated page to work — see `sypher-api/README.md` for setup. The `.env.local` file should contain:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```
