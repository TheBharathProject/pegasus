# Naukri Clear Next.js Clone

This workspace contains a Next.js reconstruction of `naukriclear.com` based on live route discovery, DOM inspection, and authenticated API surface mapping.

## What is included

- Marketing homepage
- Login page
- Blog index and article pages
- Community hub and section pages
- Dashboard, applications, resumes, settings, and public profile pages
- Feature inventory in [docs/feature-inventory.md](/Users/shubham.dixit/Documents/Codex/2026-05-05/can-you-control-browser-for-me/docs/feature-inventory.md)

## What is not included

- The original production backend
- Real OAuth wiring
- Real storage or upload pipelines
- Community create/edit flows
- Billing implementation

## Run

The environment used to generate this project does not currently provide `npm`, `pnpm`, or `npx`, so dependencies were not installed here.

Once a package manager is available, install dependencies and run the app with one of these commands:

```bash
npm install
npm run dev
```

or

```bash
pnpm install
pnpm dev
```
