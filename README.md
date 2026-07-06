# gegarap.id

A modern two-sided marketplace connecting customers with verified local tradespeople
(_tukang_) across Yogyakarta, Indonesia.

Built with **Next.js 14 (App Router)**, **Firebase Auth**, **managed PostgreSQL +
Prisma 7**, **Tailwind CSS**, Midtrans payments, and Supabase Storage.

## Features

- Premium responsive UI with a custom Tailwind design system.
- Provider search with filters, sorting, empty states, and a local map.
- Booking flow with down payment, escrow-style payment state, receipts, and admin review tools.
- Firebase-backed customer/provider authentication.
- Provider onboarding with KYC document upload.
- Provider dashboard with job management.
- Material calculator with instant client-side estimates and a matching API endpoint.
- Typed API routes with shared validation and consistent response envelopes.

## Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 App Router, React 18 |
| Runtime | Node.js 22.x |
| Database | Managed PostgreSQL via Prisma 7 and `@prisma/adapter-pg` |
| Auth | Firebase Auth + Firestore identity bridge |
| Storage | Supabase Storage for private KYC files |
| Payments | Midtrans Snap plus pluggable disbursement |
| Styling | Tailwind CSS and CSS-variable design tokens |
| Validation | Zod shared between client and server |
| Maps | Leaflet / react-leaflet |
| AI | Anthropic Claude when `ANTHROPIC_API_KEY` is configured, deterministic fallback otherwise |

## Getting Started

### Prerequisites

- Node.js 22.x. The repo includes `.nvmrc`, so `nvm use` should select the right major version.
- npm.
- A managed PostgreSQL database connection string, for example Neon, Supabase, Railway, or RDS.

No local Docker database is required. The dev script starts Firebase emulators for local auth/Firestore.

### 1. Install Dependencies

```bash
npm install
```

On Windows, if PowerShell blocks `npm.ps1`, run the command through `npm.cmd`:

```powershell
npm.cmd install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

PowerShell equivalent:

```powershell
Copy-Item .env.example .env
```

Set `DATABASE_URL` in `.env` to your managed PostgreSQL connection string. Most
external integrations are optional in local development: blank Midtrans, Supabase,
email, and Anthropic credentials degrade to safe mock or fallback behavior.

### 3. Apply Schema and Seed

```bash
npm run setup
```

This runs `prisma db push` and seeds demo data. To run the steps separately:

```bash
npm run db:push
npm run db:seed
```

### 4. Run the App

```bash
npm run dev
```

Open <http://localhost:3000>.

### 5. Verify

```bash
npm run typecheck
npm run lint
npm test
```

If your Windows shell can see `node` from PowerShell but npm-launched `.cmd`
wrappers cannot, these direct commands are equivalent:

```powershell
node .\node_modules\typescript\bin\tsc --noEmit
node .\node_modules\next\dist\bin\next lint
node .\node_modules\vitest\vitest.mjs run
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start Firebase emulators and the Next.js dev server |
| `npm run dev:next` | Start only Next.js |
| `npm run build` | Production build, including support-contact env guard |
| `npm run start` | Start the production server |
| `npm run setup` | Push schema and seed demo data |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:push` | Push the Prisma schema to the database |
| `npm run db:migrate` | Create and apply a development migration |
| `npm run db:migrate:deploy` | Apply migrations in deploy/CI contexts |
| `npm run db:seed` | Seed demo data |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run Playwright tests |
| `npm run format` | Format with Prettier |

## Project Structure

```text
src/
  app/
    (marketing)/       Marketing pages
    (customer)/        Customer routes: search, booking, dashboard
    (provider)/        Provider onboarding and dashboard
    admin/             Admin tools
    api/               Route handlers
  components/
    ui/                Design-system primitives
    layout/            Navbar and footer
    providers/         Provider cards and search UI
    dashboard/         Dashboard tables and panels
    map/               Leaflet map components
  features/
    material-calculator/
      application/     DTO validation and orchestration
      configs/         Formula definitions
      domain/          Pure calculation engine and units
      infrastructure/  Material price registry
      presentation/    React UI
  lib/                 Services, integrations, authz, payments, utilities
prisma/
  schema.prisma        Postgres data model
  seed.ts              Demo seed data
docs-engineering/      Architecture, contracts, and subsystem notes
```

## Database

PostgreSQL is a managed cloud database. The connection string lives in `.env` as
`DATABASE_URL` and is also consumed by `prisma.config.ts`. Use the same schema
workflow locally and in production; only the connection string changes.
