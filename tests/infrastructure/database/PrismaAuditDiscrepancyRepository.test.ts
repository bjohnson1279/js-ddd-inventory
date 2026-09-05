import { PrismaAuditDiscrepancyRepository } from "../../../src/infrastructure/database/PrismaAuditDiscrepancyRepository";
import { prisma as sharedPrisma } from "../../../src/infrastructure/database/prisma";
import { AuditDiscrepancy } from "../../../src/domain/audit/AuditDiscrepancy";
import { PrismaClient } from "@prisma/client";

// Mock the entire prisma module
jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    auditDiscrepancyModel: {
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $disconnect: jest.fn(),
  }
}));

describe("PrismaAuditDiscrepancyRepository Integration Tests", () => {
  let prisma = sharedPrisma;
  let repo: PrismaAuditDiscrepancyRepository;

  beforeAll(() => {
    repo = new PrismaAuditDiscrepancyRepository();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should save and retrieve by id", async () => {
    const discrepancy = new AuditDiscrepancy(
      "D-1",
      "TENANT-1",
      "SHOPIFY_STOCK_MISMATCH",
      "REF-1",
      "EXT-1",
      "Test discrepancy"
    );

    await repo.save(discrepancy);

    expect(prisma.auditDiscrepancyModel.upsert).toHaveBeenCalledWith({
      where: { id: "D-1" },
      create: expect.objectContaining({
        id: "D-1",
        tenantId: "TENANT-1",
        status: "OPEN"
      }),
      update: expect.any(Object)
    });

    (prisma.auditDiscrepancyModel.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "D-1",
      tenantId: "TENANT-1",
      type: "SHOPIFY_STOCK_MISMATCH",
      referenceId: "REF-1",
      externalRefId: "EXT-1",
      description: "Test discrepancy",
      status: "OPEN",
      occurredAt: new Date(),
      resolvedAt: null,
      resolutionNotes: null
    });

    const retrieved = await repo.findById("D-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe("D-1");
    expect(retrieved?.tenantId).toBe("TENANT-1");
    expect(retrieved?.status).toBe("OPEN");
  });

  it("should find all by tenant and optionally by status", async () => {
    (prisma.auditDiscrepancyModel.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "D-1",
        tenantId: "TENANT-1",
        type: "TYPE-A",
        referenceId: "REF-1",
        externalRefId: null,
        description: "Desc 1",
        status: "OPEN",
        occurredAt: new Date(),
        resolvedAt: null,
        resolutionNotes: null
      },
      {
        id: "D-2",
        tenantId: "TENANT-1",
        type: "TYPE-B",
        referenceId: "REF-2",
        externalRefId: null,
        description: "Desc 2",
        status: "RESOLVED",
        occurredAt: new Date(),
        resolvedAt: new Date(),
        resolutionNotes: "Resolved"
      }
    ]);

    const tenant1All = await repo.findAll("TENANT-1");
    expect(tenant1All.length).toBe(2);
    expect(prisma.auditDiscrepancyModel.findMany).toHaveBeenCalledWith({
      where: { tenantId: "TENANT-1" },
      orderBy: { occurredAt: "desc" }
    });

    (prisma.auditDiscrepancyModel.findMany as jest.Mock).mockResolvedValueOnce([
       {
        id: "D-2",
        tenantId: "TENANT-1",
        type: "TYPE-B",
        referenceId: "REF-2",
        externalRefId: null,
        description: "Desc 2",
        status: "RESOLVED",
        occurredAt: new Date(),
        resolvedAt: new Date(),
        resolutionNotes: "Resolved"
      }
    ]);

    const tenant1Resolved = await repo.findAll("TENANT-1", "RESOLVED");
    expect(tenant1Resolved.length).toBe(1);
    expect(tenant1Resolved[0].id).toBe("D-2");
    expect(prisma.auditDiscrepancyModel.findMany).toHaveBeenCalledWith({
      where: { tenantId: "TENANT-1", status: "RESOLVED" },
      orderBy: { occurredAt: "desc" }
    });
  });

  it("should find open discrepancy by tenant, type, and referenceId", async () => {
    (prisma.auditDiscrepancyModel.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "D-1",
        tenantId: "TENANT-1",
        type: "TYPE-A",
        referenceId: "REF-1",
        externalRefId: null,
        description: "Desc 1",
        status: "OPEN",
        occurredAt: new Date(),
        resolvedAt: null,
        resolutionNotes: null
    });

    const open = await repo.findOpen("TENANT-1", "TYPE-A", "REF-1");
    expect(open).not.toBeNull();
    expect(open?.id).toBe("D-1");
    expect(prisma.auditDiscrepancyModel.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "TENANT-1",
        type: "TYPE-A",
        referenceId: "REF-1",
        status: "OPEN"
      }
    });

    (prisma.auditDiscrepancyModel.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const none = await repo.findOpen("TENANT-1", "TYPE-B", "REF-1");
    expect(none).toBeNull();
  });
});
