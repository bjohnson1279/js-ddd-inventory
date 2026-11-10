// Place jest.mock at the top before importing repo or domain files
const mockTx = {
  inventoryAuditModel: {
    upsert: jest.fn(),
  },
  inventoryAuditItemModel: {
    upsert: jest.fn(),
  },
};

jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    inventoryAuditModel: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback: any) => {
      return callback(mockTx);
    }),
    $disconnect: jest.fn(),
  },
}));

import { PrismaInventoryAuditRepository } from "../../../src/infrastructure/database/PrismaInventoryAuditRepository";
import { prisma } from "../../../src/infrastructure/database/prisma";
import { InventoryAudit } from "../../../src/domain/procurement/aggregates/InventoryAudit";
import { InventoryAuditItem } from "../../../src/domain/procurement/aggregates/InventoryAuditItem";
import { AuditStatus } from "../../../src/domain/procurement/enums/AuditStatus";

describe("PrismaInventoryAuditRepository Unit Tests", () => {
  let repository: PrismaInventoryAuditRepository;

  beforeAll(() => {
    repository = new PrismaInventoryAuditRepository();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("findById", () => {
    it("should return InventoryAudit aggregate when record is found", async () => {
      const createdAt = new Date("2025-01-01T00:00:00Z");
      const updatedAt = new Date("2025-01-02T00:00:00Z");

      (prisma.inventoryAuditModel.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "audit-1",
        auditNumber: "AUD-001",
        tenantId: "tenant-1",
        locationId: "loc-1",
        status: AuditStatus.InProgress,
        createdAt,
        updatedAt,
        items: [
          {
            id: "item-1",
            inventoryAuditId: "audit-1",
            variantId: "variant-1",
            expectedQuantity: 10,
            countedQuantity: 8,
            isCounted: true,
          },
          {
            id: "item-2",
            inventoryAuditId: "audit-1",
            variantId: "variant-2",
            expectedQuantity: 5,
            countedQuantity: null,
            isCounted: false,
          },
        ],
      });

      const audit = await repository.findById("audit-1");

      expect(prisma.inventoryAuditModel.findUnique).toHaveBeenCalledWith({
        where: { id: "audit-1" },
        include: { items: true },
      });

      expect(audit).not.toBeNull();
      expect(audit?.id).toBe("audit-1");
      expect(audit?.auditNumber).toBe("AUD-001");
      expect(audit?.tenantId).toBe("tenant-1");
      expect(audit?.locationId).toBe("loc-1");
      expect(audit?.status).toBe(AuditStatus.InProgress);
      expect(audit?.createdAt).toEqual(createdAt);
      expect(audit?.updatedAt).toEqual(updatedAt);

      expect(audit?.items).toHaveLength(2);
      expect(audit?.items[0].id).toBe("item-1");
      expect(audit?.items[0].variantId).toBe("variant-1");
      expect(audit?.items[0].expectedQuantity).toBe(10);
      expect(audit?.items[0].countedQuantity).toBe(8);
      expect(audit?.items[0].isCounted).toBe(true);
      expect(audit?.items[0].discrepancy).toBe(-2);

      expect(audit?.items[1].id).toBe("item-2");
      expect(audit?.items[1].variantId).toBe("variant-2");
      expect(audit?.items[1].expectedQuantity).toBe(5);
      expect(audit?.items[1].countedQuantity).toBeNull();
      expect(audit?.items[1].isCounted).toBe(false);
      expect(audit?.items[1].discrepancy).toBeNull();
    });

    it("should handle record with empty items or undefined items gracefully", async () => {
      (prisma.inventoryAuditModel.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "audit-empty",
        auditNumber: "AUD-EMPTY",
        tenantId: "tenant-1",
        locationId: "loc-1",
        status: AuditStatus.Draft,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: undefined,
      });

      const audit = await repository.findById("audit-empty");
      expect(audit).not.toBeNull();
      expect(audit?.items).toEqual([]);
    });

    it("should return null when record is not found", async () => {
      (prisma.inventoryAuditModel.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const audit = await repository.findById("non-existent");
      expect(audit).toBeNull();
    });
  });

  describe("findByNumber", () => {
    it("should return InventoryAudit aggregate when record is found by audit number", async () => {
      (prisma.inventoryAuditModel.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "audit-2",
        auditNumber: "AUD-002",
        tenantId: "tenant-2",
        locationId: "loc-2",
        status: AuditStatus.Draft,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      });

      const audit = await repository.findByNumber("AUD-002");

      expect(prisma.inventoryAuditModel.findUnique).toHaveBeenCalledWith({
        where: { auditNumber: "AUD-002" },
        include: { items: true },
      });
      expect(audit).not.toBeNull();
      expect(audit?.id).toBe("audit-2");
      expect(audit?.auditNumber).toBe("AUD-002");
    });

    it("should return null when record is not found by audit number", async () => {
      (prisma.inventoryAuditModel.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const audit = await repository.findByNumber("NON-EXISTENT");
      expect(audit).toBeNull();
    });
  });

  describe("findAll", () => {
    it("should return list of all InventoryAudit aggregates", async () => {
      (prisma.inventoryAuditModel.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "audit-1",
          auditNumber: "AUD-001",
          tenantId: "tenant-1",
          locationId: "loc-1",
          status: AuditStatus.Draft,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [],
        },
        {
          id: "audit-2",
          auditNumber: "AUD-002",
          tenantId: "tenant-1",
          locationId: "loc-2",
          status: AuditStatus.Completed,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [
            {
              id: "item-1",
              inventoryAuditId: "audit-2",
              variantId: "variant-1",
              expectedQuantity: 10,
              countedQuantity: 10,
              isCounted: true,
            },
          ],
        },
      ]);

      const audits = await repository.findAll();

      expect(prisma.inventoryAuditModel.findMany).toHaveBeenCalledWith({
        include: { items: true },
      });
      expect(audits).toHaveLength(2);
      expect(audits[0].id).toBe("audit-1");
      expect(audits[1].id).toBe("audit-2");
      expect(audits[1].items).toHaveLength(1);
    });

    it("should return empty array when no audits exist", async () => {
      (prisma.inventoryAuditModel.findMany as jest.Mock).mockResolvedValueOnce([]);

      const audits = await repository.findAll();
      expect(audits).toEqual([]);
    });
  });

  describe("save", () => {
    it("should save audit and its items within a transaction", async () => {
      const items = [
        new InventoryAuditItem("item-1", "variant-1", 20, 18, true),
        new InventoryAuditItem("item-2", "variant-2", 15, null, false),
      ];

      const audit = new InventoryAudit(
        "audit-save-1",
        "AUD-SAVE-1",
        "tenant-save",
        "loc-save",
        AuditStatus.InProgress,
        items
      );

      await repository.save(audit);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      // Verify audit model upsert
      expect(mockTx.inventoryAuditModel.upsert).toHaveBeenCalledWith({
        where: { id: "audit-save-1" },
        update: {
          status: AuditStatus.InProgress,
          tenantId: "tenant-save",
          locationId: "loc-save",
        },
        create: {
          id: "audit-save-1",
          auditNumber: "AUD-SAVE-1",
          status: AuditStatus.InProgress,
          tenantId: "tenant-save",
          locationId: "loc-save",
        },
      });

      // Verify each audit item upsert
      expect(mockTx.inventoryAuditItemModel.upsert).toHaveBeenCalledTimes(2);

      expect(mockTx.inventoryAuditItemModel.upsert).toHaveBeenNthCalledWith(1, {
        where: { id: "item-1" },
        update: {
          countedQuantity: 18,
          isCounted: true,
          expectedQuantity: 20,
        },
        create: {
          id: "item-1",
          inventoryAuditId: "audit-save-1",
          variantId: "variant-1",
          expectedQuantity: 20,
          countedQuantity: 18,
          isCounted: true,
        },
      });

      expect(mockTx.inventoryAuditItemModel.upsert).toHaveBeenNthCalledWith(2, {
        where: { id: "item-2" },
        update: {
          countedQuantity: null,
          isCounted: false,
          expectedQuantity: 15,
        },
        create: {
          id: "item-2",
          inventoryAuditId: "audit-save-1",
          variantId: "variant-2",
          expectedQuantity: 15,
          countedQuantity: null,
          isCounted: false,
        },
      });
    });

    it("should save audit without items", async () => {
      const audit = new InventoryAudit(
        "audit-no-items",
        "AUD-NO-ITEMS",
        "tenant-1",
        "loc-1",
        AuditStatus.Draft,
        []
      );

      await repository.save(audit);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.inventoryAuditModel.upsert).toHaveBeenCalledWith({
        where: { id: "audit-no-items" },
        update: {
          status: AuditStatus.Draft,
          tenantId: "tenant-1",
          locationId: "loc-1",
        },
        create: {
          id: "audit-no-items",
          auditNumber: "AUD-NO-ITEMS",
          status: AuditStatus.Draft,
          tenantId: "tenant-1",
          locationId: "loc-1",
        },
      });
      expect(mockTx.inventoryAuditItemModel.upsert).not.toHaveBeenCalled();
    });
  });
});
