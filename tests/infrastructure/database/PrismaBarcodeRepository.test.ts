import { PrismaBarcodeRepository } from "../../../src/infrastructure/database/PrismaBarcodeRepository";
import { VariantBarcodeSet } from "../../../src/domain/barcode/aggregates/VariantBarcodeSet";
import { Barcode } from "../../../src/domain/barcode/valueObjects/Barcode";
import { BarcodeSymbology } from "../../../src/domain/barcode/enums/BarcodeSymbology";
import { BarcodeSource } from "../../../src/domain/barcode/enums/BarcodeSource";
import { DomainEventDispatcher } from "../../../src/domain/events/DomainEventDispatcher";
import { prisma as mockPrisma } from "../../../src/infrastructure/database/prisma";

jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    barcodeAssignmentModel: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  },
}));

jest.mock("../../../src/domain/events/DomainEventDispatcher", () => ({
  DomainEventDispatcher: {
    dispatch: jest.fn(),
  },
}));

describe("PrismaBarcodeRepository", () => {
  let repository: PrismaBarcodeRepository;

  beforeEach(() => {
    repository = new PrismaBarcodeRepository();
    jest.clearAllMocks();
  });

  describe("findVariantByBarcodeValue", () => {
    it("should return the variantId if assignment exists", async () => {
      const mockValue = " 123456 ";
      const normalizedValue = "123456";
      (mockPrisma.barcodeAssignmentModel.findUnique as jest.Mock).mockResolvedValue({
        variantId: "variant-1",
      });

      const result = await repository.findVariantByBarcodeValue(mockValue);

      expect(mockPrisma.barcodeAssignmentModel.findUnique).toHaveBeenCalledWith({
        where: { barcodeValue: normalizedValue },
      });
      expect(result).toBe("variant-1");
    });

    it("should return null if assignment does not exist", async () => {
      (mockPrisma.barcodeAssignmentModel.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findVariantByBarcodeValue("unknown");

      expect(result).toBeNull();
    });
  });

  describe("findSetForVariant", () => {
    it("should rebuild VariantBarcodeSet from database records", async () => {
      const variantId = "variant-1";
      const records = [
        {
          id: "1",
          variantId,
          barcodeValue: "012345678905",
          symbology: BarcodeSymbology.UPC_A,
          source: BarcodeSource.Internal,
          isPrimary: true,
          assignedAt: new Date(),
        },
        {
          id: "2",
          variantId,
          barcodeValue: "AUTO-GEN-123",
          symbology: BarcodeSymbology.CODE_128,
          source: BarcodeSource.Supplier,
          isPrimary: false,
          assignedAt: new Date(),
        },
      ];
      (mockPrisma.barcodeAssignmentModel.findMany as jest.Mock).mockResolvedValue(records);

      const set = await repository.findSetForVariant(variantId);

      expect(mockPrisma.barcodeAssignmentModel.findMany).toHaveBeenCalledWith({
        where: { variantId },
      });
      expect(set.variantId).toBe(variantId);

      const all = set.all();
      expect(all).toHaveLength(2);
      expect(all[0].barcode.value).toBe("012345678905");
      expect(all[1].barcode.value).toBe("AUTO-GEN-123");
      expect(set.releaseEvents()).toHaveLength(0);
    });

    it("should return empty VariantBarcodeSet if no records exist", async () => {
      (mockPrisma.barcodeAssignmentModel.findMany as jest.Mock).mockResolvedValue([]);

      const set = await repository.findSetForVariant("empty-variant");

      expect(set.variantId).toBe("empty-variant");
      expect(set.all()).toHaveLength(0);
    });
  });

  describe("saveSet", () => {
    it("should save VariantBarcodeSet and dispatch events", async () => {
      const variantId = "variant-1";
      const set = new VariantBarcodeSet(variantId);
      const barcode1 = new Barcode(BarcodeSymbology.UPC_A, "012345678905");
      set.assign(barcode1, BarcodeSource.Internal, true);

      // Re-initialize the dispatcher mock to make sure we capture events correctly
      const dispatchMock = DomainEventDispatcher.dispatch as jest.Mock;

      await repository.saveSet(set);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.barcodeAssignmentModel.deleteMany).toHaveBeenCalledWith({
        where: { variantId },
      });
      expect(mockPrisma.barcodeAssignmentModel.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            variantId,
            barcodeValue: "012345678905",
            symbology: BarcodeSymbology.UPC_A,
            source: BarcodeSource.Internal,
            isPrimary: true,
          }),
        ]),
      });
      expect(dispatchMock).toHaveBeenCalled();
    });

    it("should handle empty VariantBarcodeSet", async () => {
      const variantId = "variant-1";
      const set = new VariantBarcodeSet(variantId);
      set.releaseEvents();

      await repository.saveSet(set);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.barcodeAssignmentModel.deleteMany).toHaveBeenCalledWith({
        where: { variantId },
      });
      expect(mockPrisma.barcodeAssignmentModel.createMany).not.toHaveBeenCalled();
      expect(DomainEventDispatcher.dispatch).toHaveBeenCalledWith([]);
    });
  });
});
