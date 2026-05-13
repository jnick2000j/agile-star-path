# TaskMaster

PRINCE2 + MSP + Agile Program Information Management Platform (PIMP) with
integrated Helpdesk/ITSM, Service Catalog, Knowledge Base and LMS.

## Editions

- **Cloud** — runs on Lovable Cloud. Edit at the project's Lovable URL;
  changes commit to this repo automatically.
- **On-premises** — single-host or HA, air-gappable. See
  [`onprem/README.md`](./onprem/README.md) and [`onprem/docs/`](./onprem/docs/).

## Local development

```sh
npm i
npm run dev
```

Requires Node.js 20+ (via [nvm](https://github.com/nvm-sh/nvm)).

## Stack

Vite · React 18 · TypeScript · Tailwind · shadcn/ui · Supabase
(Postgres + Edge Functions + Auth + Storage).

## Key docs

- **In-app**: `Documentation` in the sidebar — methodology guides,
  templates, feature reference.
- **Operators (on-prem)**: [`onprem/docs/`](./onprem/docs/) —
  install, upgrade, scaling, AI provider, SMTP, object storage,
  [user provisioning & SSO](./onprem/docs/user-provisioning.md).
- **Lovable platform**: <https://docs.lovable.dev/>

## Deployment

- **Cloud** — Share → Publish in Lovable.
- **On-prem** — `cd onprem && cp .env.example .env && ./scripts/install.sh`.
  Upgrades use signed versioned bundles — see
  [`onprem/docs/upgrade.md`](./onprem/docs/upgrade.md).

## Custom domains

Cloud projects: Project → Settings → Domains → Connect Domain.
On-prem: set `DOMAIN` in `.env` and provide TLS in `tls/`.
