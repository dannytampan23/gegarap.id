# Onboarding Guide

How to understand gegarap.id quickly, in the order that builds the most context.

## 1. Read These First

1. [`system-overview.md`](system-overview.md) - the shape of the system.
2. This guide - entry points and the three flows that matter.
3. [`modules/payments-and-escrow.md`](modules/payments-and-escrow.md) - the heart
   of the product.

## 2. Run It Locally

| Step | Command |
| --- | --- |
| Install | `npm install` |
| Env | copy `.env.example` to `.env`, then fill `DATABASE_URL` and any integration credentials you need |
| Schema + seed | `npm run setup` against your managed Postgres database |
| Dev server | `npm run dev` |
| Typecheck | `npm run typecheck` |
| Tests | `npm test` |

Without external credentials, payments are mocked, KYC upload no-ops, the AI
assistant uses its deterministic fallback, and WhatsApp is a plain `wa.me` link.

On Windows, if PowerShell blocks `npm.ps1`, use `npm.cmd run <script>`. If npm's
`.cmd` wrappers cannot find `node`, run the direct verification commands from
the root README.

## 3. Entry Points

- **Pages (App Router):** `src/app/(marketing)`, `src/app/(customer)`,
  `src/app/(provider)`, `src/app/admin`.
- **HTTP API:** `src/app/api/**/route.ts` - see [`contracts/api.md`](contracts/api.md).
- **Server actions:** `src/app/actions/*`.
- **Business logic:** `src/lib/**` (services in `src/lib/services`, the payment
  state machine in `src/lib/payment-state.ts`).

## 4. The Three Key Flows

### Booking to DP Payment

`POST /api/bookings` (`src/lib/services/booking.ts`) creates a `Job` and a
`Payment` in `PENDING`, snapshots fees from `FeeConfig`, and returns a Midtrans
Snap token. The customer pays the DP; Midtrans calls the webhook.

### Webhook to Escrow to Release

`POST /api/webhooks/midtrans` (`src/lib/services/midtrans-webhook.ts`) verifies
the signature, dedupes via `WebhookEvent`, and requests `PENDING -> PAID`. Work
progresses through `start`, `mark-done`, customer `complete`, or the 72h
`auto-release` cron, which runs `releaseAndSettle`.

### Identity and Contact

Login is Firebase email/password or Google; a WhatsApp number is resolved to an
email via `POST /api/auth/resolve-identifier`. The number is stored as a contact
and shown as a `wa.me` click-to-chat once the DP unlocks it. The app does not
send programmatic WhatsApp messages.

## 5. Conventions

- API handlers return `ok(data)` / `fail(message, status)` from `src/lib/api.ts`.
- Authorization helpers live in `src/lib/authz.ts` and `src/lib/admin-guard.ts`.
- Money is integer Rupiah; format with `formatCurrency` in `src/lib/utils.ts`.
- Documentation goes in `docs-engineering/`, not in code comments.
