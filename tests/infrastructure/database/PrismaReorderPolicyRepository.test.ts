jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    reorderPolicyModel: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { PrismaReorderPolicyRepository } from "../../../src/infrastructure/database/PrismaReorderPolicyRepository";
import { ReorderPolicy } from "../../../src/domain/procurement/aggregates/ReorderPolicy";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { prisma as mockPrisma } from "../../../src/infrastructure/database/prisma";

describe("PrismaReorderPolicyRepository", () => {
  let repository: PrismaReorderPolicyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaReorderPolicyRepository();
  });

  describe("findBySkuAndLocation", () => {
    it("should return a mapped ReorderPolicy when a record is found", async () => {
      const mockRecord = {
        id: "policy-1",
        sku: "SKU-ITEM-123",
        locationId: "LOC-WH-1",
        reorderPoint: 50,
        reorderQuantity: 100,
        safetyStock: 20,
        dynamicRopEnabled: true,
      };

      (mockPrisma.reorderPolicyModel.findUnique as jest.Mock).mockResolvedValue(mockRecord);

      const sku = SKU.create("SKU-ITEM-123");
      const result = await repository.findBySkuAndLocation(sku, "LOC-WH-1");

      expect(mockPrisma.reorderPolicyModel.findUnique).toHaveBeenCalledWith({
        where: {
          sku_locationId: {
            sku: "SKU-ITEM-123",
            locationId: "LOC-WH-1",
          },
        },
      });

      expect(result).toBeInstanceOf(ReorderPolicy);
      expect(result?.id).toBe("policy-1");
      expect(result?.sku.getValue()).toBe("SKU-ITEM-123");
      expect(result?.locationId).toBe("LOC-WH-1");
      expect(result?.reorderPoint).toBe(50);
      expect(result?.reorderQuantity).toBe(100);
      expect(result?.safetyStock).toBe(20);
      expect(result?.dynamicRopEnabled).toBe(true);
    });

    it("should return null when no record is found", async () => {
      (mockPrisma.reorderPolicyModel.findUnique as jest.Mock).mockResolvedValue(null);

      const sku = SKU.create("NON-EXISTENT");
      const result = await repository.findBySkuAndLocation(sku, "LOC-UNKNOWN");

      expect(mockPrisma.reorderPolicyModel.findUnique).toHaveBeenCalledWith({
        where: {
          sku_locationId: {
            sku: "NON-EXISTENT",
            locationId: "LOC-UNKNOWN",
          },
        },
      });
      expect(result).toBeNull();
    });
  });

  describe("save", () => {
    it("should upsert a ReorderPolicy correctly", async () => {
      (mockPrisma.reorderPolicyModel.upsert as jest.Mock).mockResolvedValue({});

      const policy = new ReorderPolicy(
        "policy-1",
        SKU.create("SKU-ITEM-123"),
        "LOC-WH-1",
        50,
        100,
        20,
        true
      );

      await repository.save(policy);

      expect(mockPrisma.reorderPolicyModel.upsert).toHaveBeenCalledWith({
        where: {
          sku_locationId: {
            sku: "SKU-ITEM-123",
            locationId: "LOC-WH-1",
          },
        },
        update: {
          reorderPoint: 50,
          reorderQuantity: 100,
          safetyStock: 20,
          dynamicRopEnabled: true,
        },
        create: {
          id: "policy-1",
          sku: "SKU-ITEM-123",
          locationId: "LOC-WH-1",
          reorderPoint: 50,
          reorderQuantity: 100,
          safetyStock: 20,
          dynamicRopEnabled: true,
        },
      });
    });
  });

  describe("findAllByLocation", () => {
    it("should return mapped ReorderPolicy aggregates for the given location", async () => {
      const mockRecords = [
        {
          id: "policy-1",
          sku: "SKU-1",
          locationId: "LOC-WH-1",
          reorderPoint: 10,
          reorderQuantity: 50,
          safetyStock: 5,
          dynamicRopEnabled: false,
        },
        {
          id: "policy-2",
          sku: "SKU-2",
          locationId: "LOC-WH-1",
          reorderPoint: 20,
          reorderQuantity: 80,
          safetyStock: 10,
          dynamicRopEnabled: true,
        },
      ];

      (mockPrisma.reorderPolicyModel.findMany as jest.Mock).mockResolvedValue(mockRecords);

      const results = await repository.findAllByLocation("LOC-WH-1");

      expect(mockPrisma.reorderPolicyModel.findMany).toHaveBeenCalledWith({
        where: { locationId: "LOC-WH-1" },
      });
      expect(results).toHaveLength(2);
      expect(results[0]).toBeInstanceOf(ReorderPolicy);
      expect(results[0].id).toBe("policy-1");
      expect(results[0].sku.getValue()).toBe("SKU-1");
      expect(results[0].locationId).toBe("LOC-WH-1");
      expect(results[0].reorderPoint).toBe(10);
      expect(results[0].reorderQuantity).toBe(50);
      expect(results[0].safetyStock).toBe(5);
      expect(results[0].dynamicRopEnabled).toBe(false);

      expect(results[1]).toBeInstanceOf(ReorderPolicy);
      expect(results[1].id).toBe("policy-2");
      expect(results[1].sku.getValue()).toBe("SKU-2");
      expect(results[1].locationId).toBe("LOC-WH-1");
      expect(results[1].reorderPoint).toBe(20);
      expect(results[1].reorderQuantity).toBe(80);
      expect(results[1].safetyStock).toBe(10);
      expect(results[1].dynamicRopEnabled).toBe(true);
    });

    it("should return an empty array if no policies are found for location", async () => {
      (mockPrisma.reorderPolicyModel.findMany as jest.Mock).mockResolvedValue([]);

      const results = await repository.findAllByLocation("LOC-EMPTY");

      expect(mockPrisma.reorderPolicyModel.findMany).toHaveBeenCalledWith({
        where: { locationId: "LOC-EMPTY" },
      });
      expect(results).toEqual([]);
    });
  });

  describe("findAll", () => {
    it("should return all mapped ReorderPolicy aggregates", async () => {
      const mockRecords = [
        {
          id: "policy-1",
          sku: "SKU-1",
          locationId: "LOC-WH-1",
          reorderPoint: 10,
          reorderQuantity: 50,
          safetyStock: 5,
          dynamicRopEnabled: false,
        },
      ];

      (mockPrisma.reorderPolicyModel.findMany as jest.Mock).mockResolvedValue(mockRecords);

      const results = await repository.findAll();

      expect(mockPrisma.reorderPolicyModel.findMany).toHaveBeenCalledWith();
      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(ReorderPolicy);
      expect(results[0].id).toBe("policy-1");
      expect(results[0].sku.getValue()).toBe("SKU-1");
      expect(results[0].locationId).toBe("LOC-WH-1");
      expect(results[0].reorderPoint).toBe(10);
      expect(results[0].reorderQuantity).toBe(50);
      expect(results[0].safetyStock).toBe(5);
      expect(results[0].dynamicRopEnabled).toBe(false);
    });

    it("should return an empty array if no records exist", async () => {
      (mockPrisma.reorderPolicyModel.findMany as jest.Mock).mockResolvedValue([]);

      const results = await repository.findAll();

      expect(mockPrisma.reorderPolicyModel.findMany).toHaveBeenCalledWith();
      expect(results).toEqual([]);
    });
  });
});
