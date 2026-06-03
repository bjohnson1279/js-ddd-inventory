import { BarcodeRegistry } from "../../../src/domain/barcode/services/BarcodeRegistry";
import { InternalBarcodeGenerator } from "../../../src/domain/barcode/services/InternalBarcodeGenerator";
import { BarcodeScanDispatcher, ScanContext, IScanHandler } from "../../../src/domain/barcode/services/BarcodeScanDispatcher";
import { InMemoryBarcodeRepository } from "../../../src/infrastructure/database/InMemoryBarcodeRepository";
import { Barcode } from "../../../src/domain/barcode/valueObjects/Barcode";
import { BarcodeSymbology } from "../../../src/domain/barcode/enums/BarcodeSymbology";
import { BarcodeSource } from "../../../src/domain/barcode/enums/BarcodeSource";
import { BarcodeNotFoundException } from "../../../src/domain/barcode/exceptions/BarcodeNotFoundException";

describe("Barcode Domain Services", () => {
  let repository: InMemoryBarcodeRepository;
  let registry: BarcodeRegistry;
  let generator: InternalBarcodeGenerator;
  let dispatcher: BarcodeScanDispatcher;

  beforeEach(() => {
    repository = new InMemoryBarcodeRepository();
    registry = new BarcodeRegistry(repository);
    generator = new InternalBarcodeGenerator(registry);
    dispatcher = new BarcodeScanDispatcher(registry);
  });

  describe("BarcodeRegistry", () => {
    it("should resolve scanned values to variantIds", async () => {
      const set = await repository.findSetForVariant("VAR-123");
      const barcode = new Barcode(BarcodeSymbology.UPC_A, "012345678905");
      set.assign(barcode, BarcodeSource.Supplier);
      await repository.saveSet(set);

      const resolved = await registry.resolve("012345678905");
      expect(resolved).toBe("VAR-123");

      const resolvedTrimming = await registry.resolve("  012345678905  ");
      expect(resolvedTrimming).toBe("VAR-123");
    });

    it("should throw BarcodeNotFoundException if barcode not registered", async () => {
      await expect(registry.resolve("012345678905")).rejects.toThrow(BarcodeNotFoundException);
    });

    it("should correctly report isRegistered status", async () => {
      expect(await registry.isRegistered("012345678905")).toBe(false);

      const set = await repository.findSetForVariant("VAR-123");
      const barcode = new Barcode(BarcodeSymbology.UPC_A, "012345678905");
      set.assign(barcode, BarcodeSource.Supplier);
      await repository.saveSet(set);

      expect(await registry.isRegistered("012345678905")).toBe(true);
    });
  });

  describe("InternalBarcodeGenerator", () => {
    it("should generate a Code 128 barcode", async () => {
      const barcode = await generator.generate("VAR-456", "TEN-7");
      expect(barcode.symbology).toBe(BarcodeSymbology.CODE_128);
      expect(barcode.value).toMatch(/^INV-[A-Z0-9]{4}-[A-Z0-9]{8}$/);
    });

    it("should generate unique barcodes by retrying on collisions", async () => {
      const originalIsRegistered = registry.isRegistered;
      let calls = 0;
      registry.isRegistered = async (val: string): Promise<boolean> => {
        calls++;
        if (calls === 1) {
          return true; // pretend collision
        }
        return false;
      };

      const barcode = await generator.generate("VAR-456", "TEN-7");
      expect(barcode.value).toBeDefined();
      expect(calls).toBe(2);

      registry.isRegistered = originalIsRegistered;
    });
  });

  describe("BarcodeScanDispatcher", () => {
    it("should route raw scans to the registered context handler", async () => {
      const set = await repository.findSetForVariant("VAR-123");
      const barcode = new Barcode(BarcodeSymbology.UPC_A, "012345678905");
      set.assign(barcode, BarcodeSource.Supplier);
      await repository.saveSet(set);

      let handledVariantId: string | null = null;
      let handledRawScan: string | null = null;
      let handledPayload: any = null;

      const mockHandler: IScanHandler = {
        async handle(variantId: string, rawScan: string, payload: any): Promise<void> {
          handledVariantId = variantId;
          handledRawScan = rawScan;
          handledPayload = payload;
        },
      };

      dispatcher.register(ScanContext.PointOfSale, mockHandler);

      await dispatcher.dispatch("012345678905", ScanContext.PointOfSale, { quantity: 2, saleId: "S-999" });

      expect(handledVariantId).toBe("VAR-123");
      expect(handledRawScan).toBe("012345678905");
      expect(handledPayload).toEqual({ quantity: 2, saleId: "S-999" });
    });

    it("should throw error if dispatching to unregistered scan context", async () => {
      const set = await repository.findSetForVariant("VAR-123");
      const barcode = new Barcode(BarcodeSymbology.UPC_A, "012345678905");
      set.assign(barcode, BarcodeSource.Supplier);
      await repository.saveSet(set);

      await expect(dispatcher.dispatch("012345678905", ScanContext.Receiving)).rejects.toThrow(
        /No handler registered/
      );
    });

    it("should throw error if dispatching to arbitrary unregistered string context", async () => {
      const set = await repository.findSetForVariant("VAR-123");
      const barcode = new Barcode(BarcodeSymbology.UPC_A, "012345678905");
      set.assign(barcode, BarcodeSource.Supplier);
      await repository.saveSet(set);

      await expect(dispatcher.dispatch("012345678905", "unknown_context" as ScanContext)).rejects.toThrow(
        /No handler registered for scan context: unknown_context/
      );
    });
  });
});
