-- Safer provider identity verification.
-- Legacy KTP/NIK columns remain for compatibility, but new code no longer writes
-- KTP paths or raw NIK values.

ALTER TABLE "ProviderProfile"
ADD COLUMN IF NOT EXISTS "nikHash" TEXT,
ADD COLUMN IF NOT EXISTS "nikLast4" TEXT,
ADD COLUMN IF NOT EXISTS "identityStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN IF NOT EXISTS "identitySubmittedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "identityVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "identityRejectedReason" TEXT,
ADD COLUMN IF NOT EXISTS "verifiedByAdminId" TEXT,
ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "payoutStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN IF NOT EXISTS "payoutVerifiedAt" TIMESTAMP(3);

UPDATE "ProviderProfile"
SET
  "nikLast4" = RIGHT("nik", 4)
WHERE "nikLast4" IS NULL
  AND "nik" ~ '^[0-9]{16}$';

UPDATE "ProviderProfile"
SET
  "identityStatus" = CASE
    WHEN "kycStatus" = 'APPROVED' OR "isVerified" = true THEN 'MANUALLY_VERIFIED'
    WHEN "kycStatus" = 'REJECTED' THEN 'REJECTED'
    WHEN "kycStatus" = 'PENDING' THEN 'IDENTITY_SUBMITTED'
    ELSE "identityStatus"
  END,
  "identitySubmittedAt" = COALESCE("identitySubmittedAt", "createdAt"),
  "identityVerifiedAt" = CASE
    WHEN "kycStatus" = 'APPROVED' OR "isVerified" = true THEN COALESCE("identityVerifiedAt", "kycReviewedAt")
    ELSE "identityVerifiedAt"
  END,
  "identityRejectedReason" = CASE
    WHEN "kycStatus" = 'REJECTED' THEN COALESCE("identityRejectedReason", "kycReason")
    ELSE "identityRejectedReason"
  END,
  "verifiedByAdminId" = CASE
    WHEN "kycReviewedById" IS NOT NULL THEN COALESCE("verifiedByAdminId", "kycReviewedById")
    ELSE "verifiedByAdminId"
  END;

CREATE INDEX IF NOT EXISTS "ProviderProfile_identityStatus_idx" ON "ProviderProfile" ("identityStatus");
CREATE INDEX IF NOT EXISTS "ProviderProfile_nikHash_idx" ON "ProviderProfile" ("nikHash");
