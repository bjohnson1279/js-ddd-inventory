import { PrismaAuditDiscrepancyRepository } from "../PrismaAuditDiscrepancyRepository";
import { AuditDiscrepancy } from "../../../domain/audit/AuditDiscrepancy";
import { prisma } from "../prisma";

jest.mock("../prisma", () => ({
  prisma: {
    auditDiscrepancyModel: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

describe("PrismaAuditDiscrepancyRepository", () => {
  let repository: PrismaAuditDiscrepancyRepository;

  beforeEach(() => {
    repository = new PrismaAuditDiscrepancyRepository();
    jest.clearAllMocks();
  });

  const createValidDiscrepancy = (id: string, tenantId: string = "tenant-1") => {
    return new AuditDiscrepancy(
      id,
      tenantId,
      "SHOPIFY_STOCK_MISMATCH",
      "ref-1",
      "ext-ref-1",
      "Test description",
      "OPEN",
      new Date("2023-01-01T00:00:00Z"),
      null,
      null
    );
  };

  describe("save", () => {
    it("should save an audit discrepancy using upsert", async () => {
      const discrepancy = createValidDiscrepancy("disc-1");
      await repository.save(discrepancy);

      expect(prisma.auditDiscrepancyModel.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.auditDiscrepancyModel.upsert).toHaveBeenCalledWith({
        where: { id: "disc-1" },
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
          resolutionNotes: discrepancy.resolutionNotes,
        },
        update: {
          status: discrepancy.status,
          resolvedAt: discrepancy.resolvedAt,
          resolutionNotes: discrepancy.resolutionNotes,
        },
      });
    });
  });

  describe("findById", () => {
    it("should return an audit discrepancy if found", async () => {
      const mockModel = {
        id: "disc-2",
        tenantId: "tenant-1",
        type: "SHOPIFY_STOCK_MISMATCH",
        referenceId: "ref-1",
        externalRefId: "ext-ref-1",
        description: "Test description",
        status: "OPEN",
        occurredAt: new Date("2023-01-01T00:00:00Z"),
        resolvedAt: null,
        resolutionNotes: null,
      };

      (prisma.auditDiscrepancyModel.findUnique as jest.Mock).mockResolvedValue(mockModel);

      const result = await repository.findById("disc-2");

      expect(prisma.auditDiscrepancyModel.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.auditDiscrepancyModel.findUnique).toHaveBeenCalledWith({
        where: { id: "disc-2" },
      });

      expect(result).toBeInstanceOf(AuditDiscrepancy);
      expect(result?.id).toBe("disc-2");
    });

    it("should return null if audit discrepancy is not found", async () => {
      (prisma.auditDiscrepancyModel.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById("disc-non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findAll", () => {
    it("should return all audit discrepancies for a tenant without status filter", async () => {
      const mockModels = [
        {
          id: "disc-3",
          tenantId: "tenant-1",
          type: "SHOPIFY_STOCK_MISMATCH",
          referenceId: "ref-1",
          externalRefId: "ext-ref-1",
          description: "Desc 1",
          status: "OPEN",
          occurredAt: new Date("2023-01-01T00:00:00Z"),
          resolvedAt: null,
          resolutionNotes: null,
        },
        {
          id: "disc-4",
          tenantId: "tenant-1",
          type: "ACCOUNTING_JOURNAL_MISSING",
          referenceId: "ref-2",
          externalRefId: "ext-ref-2",
          description: "Desc 2",
          status: "RESOLVED",
          occurredAt: new Date("2023-01-02T00:00:00Z"),
          resolvedAt: new Date("2023-01-03T00:00:00Z"),
          resolutionNotes: "Fixed",
        },
      ];

      (prisma.auditDiscrepancyModel.findMany as jest.Mock).mockResolvedValue(mockModels);

      const results = await repository.findAll("tenant-1");

      expect(prisma.auditDiscrepancyModel.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.auditDiscrepancyModel.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1" },
        orderBy: { occurredAt: "desc" },
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toBeInstanceOf(AuditDiscrepancy);
      expect(results[0].id).toBe("disc-3");
      expect(results[1]).toBeInstanceOf(AuditDiscrepancy);
      expect(results[1].id).toBe("disc-4");
    });

    it("should return all audit discrepancies for a tenant with status filter", async () => {
      const mockModels = [
        {
          id: "disc-3",
          tenantId: "tenant-1",
          type: "SHOPIFY_STOCK_MISMATCH",
          referenceId: "ref-1",
          externalRefId: "ext-ref-1",
          description: "Desc 1",
          status: "OPEN",
          occurredAt: new Date("2023-01-01T00:00:00Z"),
          resolvedAt: null,
          resolutionNotes: null,
        },
      ];

      (prisma.auditDiscrepancyModel.findMany as jest.Mock).mockResolvedValue(mockModels);

      const results = await repository.findAll("tenant-1", "OPEN");

      expect(prisma.auditDiscrepancyModel.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.auditDiscrepancyModel.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", status: "OPEN" },
        orderBy: { occurredAt: "desc" },
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("disc-3");
    });
  });

  describe("findOpen", () => {
    it("should return an open audit discrepancy if found", async () => {
      const mockModel = {
        id: "disc-5",
        tenantId: "tenant-1",
        type: "SHOPIFY_STOCK_MISMATCH",
        referenceId: "ref-1",
        externalRefId: null,
        description: "Desc",
        status: "OPEN",
        occurredAt: new Date("2023-01-01T00:00:00Z"),
        resolvedAt: null,
        resolutionNotes: null,
      };

      (prisma.auditDiscrepancyModel.findFirst as jest.Mock).mockResolvedValue(mockModel);

      const result = await repository.findOpen("tenant-1", "SHOPIFY_STOCK_MISMATCH", "ref-1");

      expect(prisma.auditDiscrepancyModel.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.auditDiscrepancyModel.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          type: "SHOPIFY_STOCK_MISMATCH",
          referenceId: "ref-1",
          status: "OPEN",
        },
      });

      expect(result).toBeInstanceOf(AuditDiscrepancy);
      expect(result?.id).toBe("disc-5");
    });

    it("should return null if open audit discrepancy is not found", async () => {
      (prisma.auditDiscrepancyModel.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repository.findOpen("tenant-1", "SHOPIFY_STOCK_MISMATCH", "ref-not-exist");

      expect(result).toBeNull();
    });
  });
});
