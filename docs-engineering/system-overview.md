# System Overview

gegarap.id is a marketplace that connects customers with verified home-service
workers (tukang) in Indonesia, with an escrow-backed payment flow.

## Tech stack decisions

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 14 (App Router) | One deployable for SSR pages, API routes, and server actions |
| Language | TypeScript (strict) | Compile-time contracts replace most defensive comments |
| ORM / DB | Prisma 7 → PostgreSQL on Railway | Typed data access; SQL relational model for money |
| Auth | Firebase Auth (email/password + Google) + Firestore identity | Managed auth; Postgres stays the source of truth for domain data |
| Payments | Midtrans Snap (charge) + Iris/gateway (disbursement, pluggable) | Indonesian market gateway; disbursement provider is swappable |
| File storage | Supabase Storage (private KTP bucket, signed URLs) | KYC documents kept off the app server |
| AI assistant | OpenAI Responses API over a keyword/filter RAG | Structured assistant search with a deterministic fallback |
| Hosting | Vercel (cloud build), GitHub Actions deploy pipeline | `ci → migrate → deploy-production` on push to `main` |

## System boundaries

- **App (Next.js)** owns request handling, the payment state machine, and all
  business rules. External services never drive state directly.
- **PostgreSQL (Railway)** is the authoritative store for money and domain data.
- **Firebase** owns credential verification and the WA→email identity lookup;
  `User.id` equals the Firebase uid.
- **Midtrans** charges customers and notifies via webhook; the webhook is treated
  as untrusted input (signature-verified, idempotency-ledgered, never allowed to
  drive an out-of-order transition).
- **Supabase** stores KYC documents; the app mints short-lived signed URLs.
- **WhatsApp** is contact-only: a stored number surfaced as a `wa.me` link. There
  is no programmatic WhatsApp send (see
  [`decisions/2026-06-29-no-inline-comments-and-externalized-docs.md`](decisions/2026-06-29-no-inline-comments-and-externalized-docs.md)
  for the documentation policy and
  [`modules/contact-and-notifications.md`](modules/contact-and-notifications.md)
  for the removal).

## Data model (PostgreSQL)

Core money + marketplace tables: `User`, `ProviderProfile`, `Job`, `Payment`,
`PaymentEvent`, `RefundRequest`, `Payout`, `FeeConfig`, `Campaign`, `Review`,
`ContactRequest`. Trust/observability: `FraudFlag`, `DeviceEvent`, `WebhookEvent`,
`AuditLog`. Assistant: `ChatSession`. Legacy/unused: `OutboxMessage` (kept to
avoid a production migration after WhatsApp removal).

Money is stored as **integer Rupiah** (no sub-unit). The lifecycle of value lives
on `Payment.status` (11 states) and is mutated only through the state machine in
`src/lib/payment-state.ts`.

## Design principles

1. **Backend-authoritative state.** Payment transitions go through one guarded
   state machine; webhooks and crons request transitions, they do not set status.
2. **Money is integer Rupiah** and only moves via `payout.ts` / `payment-state.ts`.
3. **PII is gated.** A customer's phone and full address open to the provider only
   after the DP is paid (`isContactUnlocked`); public provider data is fuzzed.
4. **External calls are best-effort and isolated.** A failing gateway/notification
   never breaks the business transaction that triggered it.
5. **Idempotency at every external seam.** Webhooks use a `WebhookEvent` ledger;
   booking creation accepts an `Idempotency-Key`.
6. **Self-documenting code, externalized prose.** See
   [`README.md`](README.md).

## Where to look next

- New here: [`onboarding.md`](onboarding.md)
- Endpoints: [`contracts/api.md`](contracts/api.md)
- A subsystem: [`modules/`](modules/)
- A specific file's functions: [`mappings/`](mappings/)
