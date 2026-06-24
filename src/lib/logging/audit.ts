import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";

type AuditInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditInput) {
  try {
    await getPrisma().auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // Avoid leaking operational logging failures into user-facing workflows.
  }
}
