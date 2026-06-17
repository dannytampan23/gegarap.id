-- Payment & infrastructure core (PROMPT MASTER Bagian 4).
--
-- Adds the escrow/lifecycle data model: money moves to integer Rupiah, Payment
-- gains the full financial snapshot + lifecycle fields, and the supporting
-- tables (PaymentEvent, RefundRequest, Payout, FeeConfig, Campaign, FraudFlag,
-- WebhookEvent) are created.
--
-- Written idempotently to match this project's `prisma db push`-managed prod
-- (safe to run via psql or db push). Additive + a lossless Float→Int cast of
-- money columns (all existing values are already whole Rupiah).

-- ── Money Float → Int (whole Rupiah, no sub-unit) ──────────────────────────
ALTER TABLE "ProviderProfile"
  ALTER COLUMN "dailyRate" TYPE INTEGER USING round("dailyRate")::integer;

ALTER TABLE "Job"
  ALTER COLUMN "dailyRate"          TYPE INTEGER USING round("dailyRate")::integer,
  ALTER COLUMN "totalFee"           TYPE INTEGER USING round("totalFee")::integer,
  ALTER COLUMN "dpAmount"           TYPE INTEGER USING round("dpAmount")::integer,
  ALTER COLUMN "platformCommission" TYPE INTEGER USING round("platformCommission")::integer,
  ALTER COLUMN "providerPayout"     TYPE INTEGER USING round("providerPayout")::integer;
ALTER TABLE "Job" ALTER COLUMN "platformCommission" SET DEFAULT 0;
ALTER TABLE "Job" ALTER COLUMN "providerPayout"     SET DEFAULT 0;

ALTER TABLE "Payment"
  ALTER COLUMN "amount"             TYPE INTEGER USING round("amount")::integer,
  ALTER COLUMN "disbursedAmount"    TYPE INTEGER USING round("disbursedAmount")::integer,
  ALTER COLUMN "platformFeeCharged" TYPE INTEGER USING round("platformFeeCharged")::integer;

-- ── Payment: lifecycle + financial snapshot + gateway columns ──────────────
ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "customerId"        TEXT,
  ADD COLUMN IF NOT EXISTS "providerProfileId" TEXT,
  ADD COLUMN IF NOT EXISTS "dpAmount"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "remainingAmount"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "platformFee"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "providerAmount"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "feeConfigId"       TEXT,
  ADD COLUMN IF NOT EXISTS "campaignId"        TEXT,
  ADD COLUMN IF NOT EXISTS "paymentGateway"    TEXT NOT NULL DEFAULT 'MIDTRANS',
  ADD COLUMN IF NOT EXISTS "idempotencyKey"    TEXT;

-- Backfill the snapshot from the existing Job financials.
UPDATE "Payment" p SET
  "customerId"        = j."customerId",
  "providerProfileId" = j."providerProfileId",
  "dpAmount"          = j."dpAmount",
  "platformFee"       = j."platformCommission",
  "providerAmount"    = j."providerPayout",
  "remainingAmount"   = GREATEST(j."totalFee" - j."dpAmount", 0)
FROM "Job" j
WHERE p."jobId" = j."id";

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_idempotencyKey_key" ON "Payment" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "Payment_customerId_idx"        ON "Payment" ("customerId");
CREATE INDEX IF NOT EXISTS "Payment_providerProfileId_idx" ON "Payment" ("providerProfileId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx"            ON "Payment" ("status");

-- FKs for the new denormalised principals (optional → SET NULL on delete).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_customerId_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_providerProfileId_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_providerProfileId_fkey"
      FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── PaymentEvent (append-only audit log) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "PaymentEvent" (
  "id"                TEXT NOT NULL,
  "paymentId"         TEXT NOT NULL,
  "fromStatus"        TEXT,
  "toStatus"          TEXT NOT NULL,
  "triggeredBy"       TEXT NOT NULL,
  "reason"            TEXT,
  "rawWebhookPayload" JSONB,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentEvent_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PaymentEvent_paymentId_idx" ON "PaymentEvent" ("paymentId");

-- ── RefundRequest ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "RefundRequest" (
  "id"             TEXT NOT NULL,
  "paymentId"      TEXT NOT NULL,
  "requestedById"  TEXT NOT NULL,
  "reason"         TEXT NOT NULL,
  "evidenceUrls"   TEXT[] NOT NULL DEFAULT '{}',
  "type"           TEXT NOT NULL,
  "amount"         INTEGER,
  "status"         TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "resolvedById"   TEXT,
  "resolvedAt"     TIMESTAMP(3),
  "resolutionNote" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RefundRequest_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "RefundRequest_paymentId_idx" ON "RefundRequest" ("paymentId");
CREATE INDEX IF NOT EXISTS "RefundRequest_status_idx"    ON "RefundRequest" ("status");

-- ── Payout ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Payout" (
  "id"                     TEXT NOT NULL,
  "providerProfileId"      TEXT NOT NULL,
  "paymentId"              TEXT NOT NULL,
  "amount"                 INTEGER NOT NULL,
  "status"                 TEXT NOT NULL DEFAULT 'SCHEDULED',
  "disbursementExternalId" TEXT,
  "failureReason"          TEXT,
  "scheduledAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "executedAt"             TIMESTAMP(3),
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payout_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payout_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Payout_providerProfileId_fkey"
    FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Payout_providerProfileId_idx" ON "Payout" ("providerProfileId");
CREATE INDEX IF NOT EXISTS "Payout_paymentId_idx"         ON "Payout" ("paymentId");
CREATE INDEX IF NOT EXISTS "Payout_status_idx"            ON "Payout" ("status");

-- ── FeeConfig ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FeeConfig" (
  "id"                   TEXT NOT NULL,
  "category"             TEXT NOT NULL,
  "platformFeePercent"   DOUBLE PRECISION NOT NULL,
  "dpPercent"            DOUBLE PRECISION NOT NULL,
  "minDpThresholdAmount" INTEGER NOT NULL DEFAULT 0,
  "highValueDpPercent"   DOUBLE PRECISION NOT NULL DEFAULT 50,
  "effectiveFrom"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo"          TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeConfig_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FeeConfig_category_idx" ON "FeeConfig" ("category");

-- ── Campaign ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Campaign" (
  "id"                 TEXT NOT NULL,
  "name"               TEXT NOT NULL,
  "feeOverridePercent" DOUBLE PRECISION NOT NULL,
  "eligibleCategories" TEXT[] NOT NULL DEFAULT '{}',
  "startDate"          TIMESTAMP(3) NOT NULL,
  "endDate"            TIMESTAMP(3) NOT NULL,
  "usageLimit"         INTEGER,
  "usedCount"          INTEGER NOT NULL DEFAULT 0,
  "active"             BOOLEAN NOT NULL DEFAULT true,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Campaign_active_idx" ON "Campaign" ("active");

-- ── FraudFlag ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FraudFlag" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "type"         TEXT NOT NULL,
  "severity"     TEXT NOT NULL DEFAULT 'LOW',
  "note"         TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"   TIMESTAMP(3),
  "resolvedById" TEXT,
  CONSTRAINT "FraudFlag_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FraudFlag_userId_idx" ON "FraudFlag" ("userId");
CREATE INDEX IF NOT EXISTS "FraudFlag_type_idx"   ON "FraudFlag" ("type");

-- ── WebhookEvent (idempotency ledger) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
  "id"             TEXT NOT NULL,
  "gateway"        TEXT NOT NULL DEFAULT 'MIDTRANS',
  "externalId"     TEXT NOT NULL,
  "eventType"      TEXT NOT NULL,
  "signatureValid" BOOLEAN NOT NULL,
  "rawPayload"     JSONB NOT NULL,
  "processedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_gateway_externalId_eventType_key"
  ON "WebhookEvent" ("gateway", "externalId", "eventType");
CREATE INDEX IF NOT EXISTS "WebhookEvent_externalId_idx" ON "WebhookEvent" ("externalId");
