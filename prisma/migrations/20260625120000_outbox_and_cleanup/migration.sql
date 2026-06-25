-- Notification outbox + dead-code cleanup.
--
-- 1. Drop the unused `passwordHash` column (auth moved to Firebase; Firebase
--    hashes credentials, so no password ever lived here in the current design).
-- 2. Drop the orphaned `OtpToken` table (WhatsApp-OTP login was replaced by
--    Firebase Auth; nothing reads or writes this table anymore).
-- 3. Add the transactional `OutboxMessage` table that decouples outbound
--    WhatsApp delivery from request handling (see schema comment).

-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordHash";

-- DropTable
DROP TABLE "OtpToken";

-- CreateTable
CREATE TABLE "OutboxMessage" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "toAddress" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboxMessage_dedupeKey_key" ON "OutboxMessage"("dedupeKey");

-- CreateIndex
CREATE INDEX "OutboxMessage_status_createdAt_idx" ON "OutboxMessage"("status", "createdAt");
