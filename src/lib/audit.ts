import type { Prisma } from '@prisma/client';
import prisma from './prisma';

/** Stable action names for the audit trail. */
export const AuditAction = {
  KycApprove: 'KYC_APPROVE',
  KycReject: 'KYC_REJECT',
  RefundTriggered: 'REFUND_TRIGGERED',
  PayoutDisbursed: 'PAYOUT_DISBURSED',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

/**
 * Append a record to the audit trail. Best-effort: a logging failure must never
 * break the action it is recording, so errors are swallowed (and surfaced to the
 * server console for monitoring).
 */
export async function recordAudit(params: {
  actorId?: string | null;
  action: AuditActionType | string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (err) {
    console.error('[audit] failed to record', params.action, params.targetId, err);
  }
}
