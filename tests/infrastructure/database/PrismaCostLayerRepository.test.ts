import { PrismaCostLayerRepository } from "../../../src/infrastructure/database/PrismaCostLayerRepository";
import { InventoryCostLayer } from "../../../src/domain/accounting/entities/InventoryCostLayer";
import { prisma } from "../../../src/infrastructure/database/prisma";

jest.mock("../../../src/infrastructure/database/prisma", () => {
  return {
    prisma: {
      inventoryCostLayerModel: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    }
  };
});

describe("PrismaCostLayerRepository", () => {
  let repository: PrismaCostLayerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaCostLayerRepository();
  });

  describe("getActiveLayersByVariantIds", () => {
    it("should return a map of active layers for given variant ids, ordered by expiration asc by default if specified", async () => {
      const mockRecord1 = {
        id: "L1", variantId: "V1", tenantId: "T1", originalQuantity: 10, unitCostCents: 100,
        receivedAt: new Date("2023-01-01"), purchaseOrderId: "PO1", locationId: "LOC1", lotNumber: "LOT1", expirationDate: new Date("2024-01-01"),
        remainingQuantity: 10
      };

      const mockRecord2 = {
        id: "L2", variantId: "V2", tenantId: "T1", originalQuantity: 5, unitCostCents: 200,
        receivedAt: new Date("2023-01-02"), purchaseOrderId: "PO2", locationId: "LOC1", lotNumber: "LOT2", expirationDate: null,
        remainingQuantity: 5
      };

      (prisma.inventoryCostLayerModel.findMany as jest.Mock).mockResolvedValue([mockRecord1, mockRecord2]);

      const result = await repository.getActiveLayersByVariantIds(["V1", "V2"], "expiration asc");

      expect(prisma.inventoryCostLayerModel.findMany).toHaveBeenCalledWith({
        where: { variantId: { in: ["V1", "V2"] }, remainingQuantity: { gt: 0 } },
        orderBy: [{ expirationDate: "asc" }, { receivedAt: "asc" }]
      });

      expect(result.get("V1")?.length).toBe(1);
      expect(result.get("V1")?.[0].id).toBe("L1");
      expect(result.get("V1")?.[0].remainingQuantity).toBe(10);
      expect(result.get("V2")?.length).toBe(1);
      expect(result.get("V2")?.[0].id).toBe("L2");
      expect(result.get("V2")?.[0].remainingQuantity).toBe(5);
    });

    it("should return empty arrays for variants with no active layers", async () => {
      (prisma.inventoryCostLayerModel.findMany as jest.Mock).mockResolvedValue([]);
      const result = await repository.getActiveLayersByVariantIds(["V1"]);
      expect(result.get("V1")).toEqual([]);
    });
  });

  describe("getActiveLayers", () => {
    it("should return active layers for a single variant", async () => {
      const mockRecord = {
        id: "L1", variantId: "V1", tenantId: "T1", originalQuantity: 10, unitCostCents: 100,
        receivedAt: new Date("2023-01-01"), purchaseOrderId: "PO1", locationId: null, lotNumber: null, expirationDate: null,
        remainingQuantity: 10
      };

      (prisma.inventoryCostLayerModel.findMany as jest.Mock).mockResolvedValue([mockRecord]);

      const result = await repository.getActiveLayers("V1", "desc");

      expect(prisma.inventoryCostLayerModel.findMany).toHaveBeenCalledWith({
        where: { variantId: "V1", remainingQuantity: { gt: 0 } },
        orderBy: { receivedAt: "desc" }
      });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe("L1");
    });
  });

  describe("save", () => {
    it("should upsert a single layer correctly", async () => {
      const layer = new InventoryCostLayer("L1", "V1", "T1", 10, 100, new Date("2023-01-01"), "PO1");
      (layer as any)._remainingQuantity = 10;

      await repository.save(layer);

      const expectedData = {
        variantId: "V1", tenantId: "T1", originalQuantity: 10, remainingQuantity: 10,
        unitCostCents: 100, receivedAt: new Date("2023-01-01"), purchaseOrderId: "PO1",
        locationId: null, isConsumed: false, lotNumber: null, expirationDate: null
      };

      expect(prisma.inventoryCostLayerModel.upsert).toHaveBeenCalledWith({
        where: { id: "L1" },
        update: expectedData,
        create: { id: "L1", ...expectedData }
      });
    });
  });

  describe("saveMany", () => {
    it("should upsert multiple layers within a transaction", async () => {
      const layer1 = new InventoryCostLayer("L1", "V1", "T1", 10, 100, new Date("2023-01-01"), "PO1");
      (layer1 as any)._remainingQuantity = 10;

      const layer2 = new InventoryCostLayer("L2", "V2", "T1", 5, 200, new Date("2023-01-02"), "PO2");
      (layer2 as any)._remainingQuantity = 0; // Exhausted

      await repository.saveMany([layer1, layer2]);

      expect(prisma.$transaction).toHaveBeenCalled();

      // Ensure upsert was mapped for each layer. Since transaction is mocked to Promise.all(promises),
      // we just verify upsert was called with the right data for the first layer.
      expect(prisma.inventoryCostLayerModel.upsert).toHaveBeenCalledWith({
        where: { id: "L1" },
        update: expect.objectContaining({ variantId: "V1", isConsumed: false }),
        create: expect.objectContaining({ variantId: "V1" })
      });

      expect(prisma.inventoryCostLayerModel.upsert).toHaveBeenCalledWith({
        where: { id: "L2" },
        update: expect.objectContaining({ variantId: "V2", isConsumed: true }),
        create: expect.objectContaining({ variantId: "V2" })
      });
    });

    it("should do nothing if empty array provided", async () => {
      await repository.saveMany([]);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryCostLayerModel.upsert).not.toHaveBeenCalled();
    });
  });
});
