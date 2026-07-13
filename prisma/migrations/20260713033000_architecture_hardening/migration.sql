CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

ALTER TABLE "OutboxMessage"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "RefundRequest"
ADD COLUMN "gatewayStatus" TEXT,
ADD COLUMN "gatewayRefundId" TEXT,
ADD COLUMN "gatewayFailureReason" TEXT,
ADD COLUMN "gatewayAttemptedAt" TIMESTAMP(3);

CREATE INDEX "RefundRequest_gatewayStatus_idx" ON "RefundRequest"("gatewayStatus");
