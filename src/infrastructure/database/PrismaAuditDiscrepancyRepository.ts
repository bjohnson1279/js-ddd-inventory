import { IAuditDiscrepancyRepository } from "../../domain/repositories/IAuditDiscrepancyRepository";
import { AuditDiscrepancy } from "../../domain/audit/AuditDiscrepancy";
import { prisma } from "./prisma";

export class PrismaAuditDiscrepancyRepository implements IAuditDiscrepancyRepository {
  async save(discrepancy: AuditDiscrepancy): Promise<void> {
    await prisma.auditDiscrepancyModel.upsert({
      where: { id: discrepancy.id },
      create: {
        id: discrepancy.id,
        tenantId: discrepancy.tenantId,
        type: discrepancy.type,
        referenceId: discrepancy.referenceId,
        externalRefId: discrepancy.externalRefId,
        description: discrepancy.description,
        status: discrepancy.status,
        occurredAt: discrepancy.occurredAt,
        resolvedAt: discrepancy.resolvedAt,
        resolutionNotes: discrepancy.resolutionNotes
      },
      update: {
        status: discrepancy.status,
        resolvedAt: discrepancy.resolvedAt,
        resolutionNotes: discrepancy.resolutionNotes
      }
    });
  }

  async findById(id: string): Promise<AuditDiscrepancy | null> {
    const model = await prisma.auditDiscrepancyModel.findUnique({
      where: { id }
    });
    if (!model) return null;
    return new AuditDiscrepancy(
      model.id,
      model.tenantId,
      model.type,
      model.referenceId,
      model.externalRefId,
      model.description,
      model.status,
      model.occurredAt,
      model.resolvedAt,
      model.resolutionNotes
    );
  }

  async findAll(tenantId: string, status?: string): Promise<AuditDiscrepancy[]> {
    const models = await prisma.auditDiscrepancyModel.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {})
      },
      orderBy: { occurredAt: "desc" }
    });
    return models.map(
      (m) =>
        new AuditDiscrepancy(
          m.id,
          m.tenantId,
          m.type,
          m.referenceId,
          m.externalRefId,
          m.description,
          m.status,
          m.occurredAt,
          m.resolvedAt,
          m.resolutionNotes
        )
    );
  }

  async findOpen(tenantId: string, type: string, referenceId: string): Promise<AuditDiscrepancy | null> {
    const model = await prisma.auditDiscrepancyModel.findFirst({
      where: {
        tenantId,
        type,
        referenceId,
        status: "OPEN"
      }
    });
    if (!model) return null;
    return new AuditDiscrepancy(
      model.id,
      model.tenantId,
      model.type,
      model.referenceId,
      model.externalRefId,
      model.description,
      model.status,
      model.occurredAt,
      model.resolvedAt,
      model.resolutionNotes
    );
  }
}
