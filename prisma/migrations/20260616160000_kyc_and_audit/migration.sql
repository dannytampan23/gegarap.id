-- KYC review state on ProviderProfile + an append-only AuditLog.
--
-- Written idempotently (IF NOT EXISTS) because this project's production schema
-- is `prisma db push`-managed, so the migration history may not line up. Safe to
-- run directly (psql) or via `prisma db push`. Purely additive — no data loss.

-- ── ProviderProfile: KYC review columns ────────────────────────────────────
ALTER TABLE "ProviderProfile"
  ADD COLUMN IF NOT EXISTS "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "kycReason" TEXT,
  ADD COLUMN IF NOT EXISTS "kycReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "kycReviewedById" TEXT;

-- Existing verified providers should read as APPROVED, not stuck PENDING.
UPDATE "ProviderProfile" SET "kycStatus" = 'APPROVED' WHERE "isVerified" = true;

CREATE INDEX IF NOT EXISTS "ProviderProfile_kycStatus_idx" ON "ProviderProfile" ("kycStatus");

-- ── AuditLog ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"         TEXT NOT NULL,
  "actorId"    TEXT,
  "action"     TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId"   TEXT NOT NULL,
  "metadata"   JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog" ("actorId");
CREATE INDEX IF NOT EXISTS "AuditLog_targetType_targetId_idx" ON "AuditLog" ("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog" ("action");
