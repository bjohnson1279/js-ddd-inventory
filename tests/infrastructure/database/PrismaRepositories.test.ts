import { PrismaBarcodeRepository } from "../../../src/infrastructure/database/PrismaBarcodeRepository";
import { PrismaSerializedItemRepository } from "../../../src/infrastructure/database/PrismaSerializedItemRepository";
import { PrismaCostLayerRepository } from "../../../src/infrastructure/database/PrismaCostLayerRepository";
import { PrismaJournalRepository } from "../../../src/infrastructure/database/PrismaJournalRepository";
import { prisma as sharedPrisma, pool } from "../../../src/infrastructure/database/prisma";

import { VariantBarcodeSet } from "../../../src/domain/barcode/aggregates/VariantBarcodeSet";
import { Barcode } from "../../../src/domain/barcode/valueObjects/Barcode";
import { BarcodeSymbology } from "../../../src/domain/barcode/enums/BarcodeSymbology";
import { BarcodeSource } from "../../../src/domain/barcode/enums/BarcodeSource";
import { SerializedItem } from "../../../src/domain/serial/aggregates/SerializedItem";
import { SerialNumber } from "../../../src/domain/serial/valueObjects/SerialNumber";
import { SerializedItemStatus } from "../../../src/domain/serial/enums/SerializedItemStatus";
import { InventoryCostLayer } from "../../../src/domain/accounting/entities/InventoryCostLayer";
import { JournalEntry } from "../../../src/domain/accounting/aggregates/JournalEntry";
import { AccountCode } from "../../../src/domain/accounting/valueObjects/AccountCode";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";
import { DebitCredit } from "../../../src/domain/accounting/enums/DebitCredit";

describe("Prisma Repositories Integration Tests", () => {
  let prisma = sharedPrisma;
  let barcodeRepo: PrismaBarcodeRepository;
  let serialRepo: PrismaSerializedItemRepository;
  let costLayerRepo: PrismaCostLayerRepository;
  let journalRepo: PrismaJournalRepository;

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  beforeAll(async () => {
    barcodeRepo = new PrismaBarcodeRepository();
    serialRepo = new PrismaSerializedItemRepository();
    costLayerRepo = new PrismaCostLayerRepository();
    journalRepo = new PrismaJournalRepository();
  });

  beforeEach(async () => {
    // Clean tables before each test to ensure isolation
    await prisma.statusTransitionModel.deleteMany();
    await prisma.serializedItemModel.deleteMany();
    await prisma.barcodeAssignmentModel.deleteMany();
    await prisma.inventoryCostLayerModel.deleteMany();
    await prisma.journalLineModel.deleteMany();
    await prisma.journalEntryModel.deleteMany();
    await prisma.kitComponentModel.deleteMany();
    await prisma.kitModel.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("Barcode Repository Integration", () => {
    it("should save and retrieve a VariantBarcodeSet", async () => {
      const variantId = "V-123";
      const set = new VariantBarcodeSet(variantId);

      const barcode1 = new Barcode(BarcodeSymbology.UPC_A, "012345678905");
      const barcode2 = new Barcode(BarcodeSymbology.CODE_128, "AUTO-GEN-123");

      set.assign(barcode1, BarcodeSource.Internal, true);
      set.assign(barcode2, BarcodeSource.Supplier, false);

      await barcodeRepo.saveSet(set);

      const retrievedSet = await barcodeRepo.findSetForVariant(variantId);
      expect(retrievedSet.variantId).toBe(variantId);
      expect(retrievedSet.all().length).toBe(2);

      const primary = retrievedSet.primaryBarcode();
      expect(primary).toBeDefined();
      expect(primary?.barcode.value).toBe("012345678905");

      const resolvedVariant = await barcodeRepo.findVariantByBarcodeValue("AUTO-GEN-123");
      expect(resolvedVariant).toBe(variantId);
    });
  });

  describe("Serialized Item Repository Integration", () => {
    it("should save, transition, and retrieve a SerializedItem with status history", async () => {
      const id = "SER-ITEM-1";
      const serialNumber = new SerialNumber("XYZ-987-123");
      const tenantId = "TENANT-A";
      const locationId = "LOC-1";

      const item = new SerializedItem(
        id,
        "VARIANT-A",
        serialNumber,
        tenantId,
        locationId,
        SerializedItemStatus.Pending
      );

      // Transition the item status
      item.receive(locationId, "actor-admin", "PO-999");
      expect(item.status).toBe(SerializedItemStatus.InStock);

      await serialRepo.save(item);

      const retrieved = await serialRepo.findBySerial(serialNumber, tenantId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(id);
      expect(retrieved?.status).toBe(SerializedItemStatus.InStock);
      expect(retrieved?.locationId).toBe(locationId);
      expect(retrieved?.history.length).toBe(1);
      expect(retrieved?.history[0].to).toBe(SerializedItemStatus.InStock);
      expect(retrieved?.history[0].reason).toContain("PO-999");

      // Verify fail-safe check
      await expect(serialRepo.findBySerialOrFail(new SerialNumber("NON-EXISTENT"), tenantId))
        .rejects.toThrow();
    });
  });

  describe("Cost Layer Repository Integration", () => {
    it("should save and retrieve active layers ordered by date", async () => {
      const variantId = "V-456";
      const tenantId = "TEN-1";

      const layerOlder = new InventoryCostLayer(
        "L-OLD",
        variantId,
        tenantId,
        10,
        500, // 5.00
        new Date("2026-01-01"),
        "PO-OLD"
      );

      const layerNewer = new InventoryCostLayer(
        "L-NEW",
        variantId,
        tenantId,
        5,
        600, // 6.00
        new Date("2026-02-01"),
        "PO-NEW"
      );

      await costLayerRepo.save(layerOlder);
      await costLayerRepo.save(layerNewer);

      // Perform a consume operation and update it
      layerOlder.consume(3);
      await costLayerRepo.save(layerOlder);

      const activeLayers = await costLayerRepo.getActiveLayers(variantId, "asc");
      expect(activeLayers.length).toBe(2);

      // The older layer received at 2026-01-01 should be first (asc)
      expect(activeLayers[0].id).toBe("L-OLD");
      expect(activeLayers[0].remainingQuantity).toBe(7); // 10 - 3 consumed

      expect(activeLayers[1].id).toBe("L-NEW");
      expect(activeLayers[1].remainingQuantity).toBe(5);
    });
  });

  describe("Journal Repository Integration", () => {
    it("should save and retrieve balanced journal entries", async () => {
      const entryId = "J-ENTRY-1";
      const tenantId = "TENANT-1";
      const entry = new JournalEntry(
        entryId,
        tenantId,
        new Date(),
        "Purchase of stock on credit",
        "PO-100",
        AccountingMethod.Accrual
      );

      // Balanced journal transaction:
      // Debit: Inventory (1200) -> 50.00
      // Credit: Accounts Payable (2000) -> 50.00
      entry.addLine(AccountCode.inventory(), 5000, DebitCredit.Debit, "Debit inventory asset");
      entry.addLine(AccountCode.accountsPayable(), 5000, DebitCredit.Credit, "Credit accounts payable liability");

      // Verify balanced invariant
      entry.assertBalanced();

      await journalRepo.save(entry);

      const allEntries = await journalRepo.findAll();
      expect(allEntries.length).toBe(1);
      expect(allEntries[0].id).toBe(entryId);
      expect(allEntries[0].description).toBe("Purchase of stock on credit");
      expect(allEntries[0].lines.length).toBe(2);

      const debitLine = allEntries[0].lines.find((l) => l.type === DebitCredit.Debit);
      expect(debitLine).toBeDefined();
      expect(debitLine?.account.code).toBe("1200");
      expect(debitLine?.amountCents).toBe(5000);
      expect(debitLine?.memo).toBe("Debit inventory asset");
    });
  });
});
