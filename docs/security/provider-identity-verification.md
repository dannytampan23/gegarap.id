# Provider Identity Verification

## Why KTP Image Upload Was Removed

gegarap.id no longer asks provider candidates to upload KTP images during MVP onboarding.
Storing KTP photos increases privacy, security, compliance, and breach-liability risk.
The safer MVP approach is to collect only the minimum identity data needed for internal review.

## Data Collected Now

- Full name
- Phone number from the authenticated account
- NIK, accepted only as 16 numeric digits
- NIK hash for internal matching
- NIK last 4 digits for masked display
- Service categories
- Service areas
- Daily rate
- Optional payout data handled by payout-specific flows

New onboarding code does not write raw NIK or KTP image paths. Legacy `nik` and
`ktpImageUrl` columns remain only for migration compatibility and must not be used
in public DTOs.

## What Is Shown Publicly

Public provider responses may include:

- Provider id
- Display name
- Service category
- Service area
- Rating and completed jobs
- Public bio
- Estimated daily rate
- Verification badges

Public responses must never include:

- Raw NIK
- NIK hash
- NIK last 4
- KTP image path or URL
- Payout method/details
- Exact private coordinates
- Internal review notes

## Verification Statuses

- `UNVERIFIED`: no usable identity signal yet
- `PHONE_VERIFIED`: reserved for a real phone-verification flow
- `IDENTITY_SUBMITTED`: provider submitted NIK and profile data for review
- `MANUALLY_VERIFIED`: admin approved the provider for marketplace listing
- `REJECTED`: admin rejected the submission
- `SUSPENDED`: provider should not be surfaced

Customer-facing labels are derived from these statuses:

- `IDENTITY_SUBMITTED`: "Identitas diajukan"
- `PHONE_VERIFIED`: "Nomor HP terverifikasi", only if real verification exists
- `MANUALLY_VERIFIED`: "Terverifikasi Gegarap"
- payout `VERIFIED`: "Rekening terverifikasi"

Do not claim official Dukcapil verification unless an actual official integration exists.

## Future e-KYC Integration Plan

The model is intentionally compatible with future providers such as VIDA, Privy,
Verihubs, ASLI RI, or an authorized Dukcapil partner. A future integration should
store vendor verification references, timestamps, result status, and audit events,
not raw identity-document images.

## Privacy And Security Rules For NIK

- Validate NIK as exactly 16 digits.
- Hash NIK before storage.
- Store `nikLast4` only for masked admin/provider display.
- Mask NIK as `************1234`.
- Never log NIK.
- Never return NIK, NIK hash, or NIK last 4 from public APIs.
- Use Prisma `select` for provider profile queries.
- Keep public DTOs separate from admin/internal DTOs.
- Prefer setting `NIK_HASH_SECRET` in production for HMAC hashing.
