# Deployment & CI/CD

Production deployment for **gegarap.id** is automated. Push to `main` and the
GitHub Actions pipeline ships the app — no manual deploy steps.

## Architecture

gegarap.id is a **Next.js 16 / React 19 monolith**: the UI and the API (route handlers under
`src/app/api/`) compile into a single deployable unit, hosted on Vercel. Auth,
data, storage and messaging are external managed services.

| Concern | Host / Service | Notes |
| --- | --- | --- |
| Web app (UI **+** API routes + server actions) | **Vercel** | Serverless; what Next.js runs best on |
| Authentication + auth profile | **Firebase** (Auth + Firestore) | Project `gegarap`; Firestore in `asia-southeast2` (Jakarta) |
| Domain & money models (users, jobs, payments, ledger) | **Managed Postgres** | via `DATABASE_URL` (Railway/Neon/Supabase); Prisma + `@prisma/adapter-pg` |
| File storage (KTP / KYC docs) | **Supabase Storage** | private bucket + signed URLs |
| Payments / escrow | **Midtrans** | Snap + webhooks |
| WhatsApp contact | Stored customer/provider phone numbers | surfaced as wa.me click-to-chat links |
| Pipeline (lint/build → migrate → deploy) | **GitHub Actions** | `.github/workflows/ci-cd.yml` |

> **Hybrid auth.** Firebase owns authentication and a small `users/{uid}` profile
> doc; Postgres stays authoritative for everything money/domain. The join key is
> `Postgres User.id == Firebase uid`. See `src/lib/firebase/` and the
> `auth_firebase_hybrid` design note.

```
 git push main
      │
      ▼
 ┌─────────┐  pass  ┌──────────────────┐  pass  ┌──────────────────────┐
 │   ci    │ ─────► │     migrate      │ ─────► │  deploy-production    │
 │ lint    │        │ prisma migrate   │        │  vercel deploy --prod │
 │ types   │        │ deploy → Postgres│        │  (UI + API)           │
 │ build   │        └──────────────────┘        └──────────────────────┘
 │ test    │
 └─────────┘
   On PRs: ci ─► deploy-preview (isolated Vercel preview URL, commented on the PR)
```

Deploys run **only after `ci` passes**, so a broken build never reaches production.
Vercel's own git auto-deploy on `main` is disabled (`vercel.json` →
`git.deploymentEnabled.main: false`) so Actions is the single deploy authority.

---

## One-time setup

### 1. Firebase (Authentication + Firestore) — project `gegarap`

In the [Firebase console](https://console.firebase.google.com/project/gegarap):

1. **Authentication → Sign-in method**: enable **Email/Password** and **Google**.
2. **Firestore Database**: create it (already done — region `asia-southeast2`,
   region is permanent and cannot be changed without recreating an empty DB).
3. **Project settings → Service accounts → Generate new private key** → download
   the JSON. This is the secret `FIREBASE_SERVICE_ACCOUNT_KEY` (paste the whole
   JSON as a single-line string into Vercel; never commit it).
4. **Deploy security rules** (from the repo, after `firebase login`):
   ```bash
   npx firebase deploy --only firestore:rules --project gegarap
   ```
   Rules live in `firestore.rules` (own-doc read/write only; `list`/`delete` denied).

> Local dev uses the **emulators** instead of the real project — see
> [Local development](#local-development).

### 2. Postgres (managed cloud DB)

Provision Supabase Postgres. Use the Supabase pooler/public
connection string with Prisma-friendly serverless params:
```
postgresql://USER:PASSWORD@HOST:PORT/db?schema=public&connection_limit=5&pool_timeout=20
```
This single value is your `DATABASE_URL`, used in **three** places: Vercel runtime,
the `vercel build` step, and the GitHub `migrate` job. The pipeline applies the
schema with `prisma migrate deploy` (forward-only, never resets data).

### 3. Vercel — the app

1. Link the project once (already linked — see `.vercel/project.json`):
   ```bash
   npm i -g vercel@latest && vercel link
   ```
2. Set environment variables in **Vercel → Settings → Environment Variables**
   for **Production** (and **Preview** to test on PR URLs). See the
   [full list below](#required-environment-variables). `.env.production.example`
   documents the same shape.
3. Grab the IDs for GitHub:
   ```bash
   cat .vercel/project.json   # -> { "orgId": "...", "projectId": "..." }
   ```

### 4. GitHub — secrets

**Settings → Secrets and variables → Actions → New repository secret:**

| Secret | Where to get it | Used by |
| --- | --- | --- |
| `VERCEL_TOKEN` | <https://vercel.com/account/tokens> | deploy jobs |
| `VERCEL_ORG_ID` | `.vercel/project.json` → `orgId` | deploy jobs |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` → `projectId` | deploy jobs |

The migration job pulls `DIRECT_URL` from the authenticated Vercel production
environment. Do not duplicate database credentials in GitHub Actions secrets.
Keep `DATABASE_URL` and `DIRECT_URL` as regular encrypted Vercel variables (not
Vercel's write-only **Sensitive** type), because `vercel pull` intentionally
returns write-only values as empty strings. Access remains limited to the Vercel
project and its authenticated CI token. API admin keys such as
`SUPABASE_SECRET_KEY` should remain write-only Sensitive variables.

> Never commit secrets. `.env` / `.env*.local` are git-ignored; `.env.example`
> and `.env.production.example` document the shape only.

---

## Required environment variables

Public `NEXT_PUBLIC_*` values ship to the browser (safe — access is governed by
Firestore rules). Everything else is **secret**. Do **not** set any
`*_EMULATOR_HOST` or `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` in production.

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Vercel + local | Firebase web config (public) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Vercel + local | `gegarap.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Vercel + local | `gegarap` |
| `NEXT_PUBLIC_WA_SUPPORT` / `NEXT_PUBLIC_EMAIL_SUPPORT` / `NEXT_PUBLIC_EMAIL_PRIVACY` | Vercel + local | optional; missing channels are hidden, invalid/placeholders fail the build |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Vercel (secret) | Admin SDK JSON, one line |
| `DATABASE_URL` | Vercel (secret) | Supabase transaction pooler (runtime), `?uselibpqcompat=true&sslmode=require` |
| `DIRECT_URL` | Vercel (secret) | Supabase session pooler (migrations), `?uselibpqcompat=true&sslmode=require` |
| `DATABASE_POOL_MAX` | Vercel | max connections per function instance (default `3`) |
| `APP_URL` | Vercel | deployed origin, e.g. `https://gegarap.id` |
| `MIDTRANS_SERVER_KEY` | Vercel (secret) | payments |
| `MIDTRANS_CLIENT_KEY` / `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Vercel | Snap client |
| `MIDTRANS_IS_PRODUCTION` | Vercel | `true` in prod |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` / `SUPABASE_BUCKET` | Vercel | private document storage |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Vercel (secret) | Meta Cloud API |
| `WHATSAPP_OTP_TEMPLATE` / `WHATSAPP_OTP_LANG` | Vercel | OTP template name/lang |
| `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | GitHub (secret) | deploy |

> ⚠️ The old NextAuth setup is gone. `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
> `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` are **no longer used** — remove them
> from Vercel to avoid confusion.

---

## How deployment is triggered

| Action | Result |
| --- | --- |
| Open / update a **Pull Request** | `ci` runs; on success a **Vercel preview** is built and the URL is commented on the PR |
| **Merge / push to `main`** | `ci` → pull Vercel env → `migrate` (Supabase) → **production deploy** |
| Manual redeploy | `git commit --allow-empty -m "redeploy" && git push` |

---

## Local development

`npm run dev` runs the Firebase **emulators** (Auth + Firestore) alongside Next,
so you never touch production data. Requirements & gotchas:

- **JDK 21+** must be installed (the Firestore emulator is Java). `scripts/dev-emulators.mjs`
  auto-detects a JDK onto PATH and points `TEMP`/`TMP` at a space-free dir (a
  Windows username with a space otherwise breaks the JVM's AF_UNIX selector and
  the Firestore emulator can't start).
- `.env.local` holds the dev Firebase config + `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`
  + the two `*_EMULATOR_HOST` vars. Flip the emulator flag to `false` (and comment
  the host vars) to smoke-test against the real `gegarap` project locally.
- Emulator UI: <http://localhost:4000>. App: <http://localhost:3000>.

```bash
npm run dev          # emulators + next
npm run typecheck && npm run lint && npm test   # the CI gate, locally
npm run test:e2e:smoke   # CI-friendly browser smoke subset
npm run audit:deps       # dependency vulnerability audit
```

Use Node.js 22.x for local and CI parity. Running newer local majors may work,
but npm will warn because `package.json` intentionally pins the production engine.

---

## Observability and maintenance

Production should configure `SENTRY_DSN` so server and route errors are forwarded
through `src/instrumentation.ts` and tagged by call sites that know payment or
booking IDs. Keep `/api/health`, the production smoke test, and the scheduled
maintenance workflow green before promoting a release.

Run the dependency audit on a regular cadence:

```bash
npm run audit:deps
```

Treat moderate+ advisories in payment, auth, storage, and server-rendering
dependencies as release blockers unless a documented mitigation already exists.

---

## Database migrations

The pipeline applies migrations with `prisma migrate deploy` (forward-only).

```bash
# 1. edit prisma/schema.prisma, create a migration locally
npm run db:migrate -- --name add_x
git add prisma/migrations && git commit && git push
# 2. CI runs `prisma migrate deploy` against Postgres automatically
```

For a *pre-existing* DB first switched to migrations, baseline once so Prisma
doesn't recreate existing tables: `npx prisma migrate resolve --applied 0_init`.

---

## Troubleshooting

**App returns 500 on auth (register/login)**
Check Vercel has `FIREBASE_SERVICE_ACCOUNT_KEY` (valid one-line JSON) and the
`NEXT_PUBLIC_FIREBASE_*` values, and that Email/Password + Google are enabled in
the Firebase console. Inspect runtime logs in Vercel.

**`Can't reach database server` / `PrismaClientInitializationError`**
`DATABASE_URL` is unset/malformed in that scope, or it's a private-network URL
unreachable from Vercel. Use a public/pooled URL with `connection_limit` set.

**Pre-migration users can't log in**
Accounts created before the Firebase migration (Postgres uuid ids, no Firebase
account) have no Firebase credential. They need a one-time Auth migration before
they can sign in.

**Build fails in CI on a DB-backed page**
Data routes are dynamic, so the build doesn't query the DB. If you add a page that
fetches at build time, add `export const dynamic = 'force-dynamic';`.

**Vercel CLI "Project not found" / wrong project**
`VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` don't match the token's account. Re-run
`vercel link` and copy fresh IDs from `.vercel/project.json`.
