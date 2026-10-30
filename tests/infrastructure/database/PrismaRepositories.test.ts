const barcodeStore: any[] = [];
const serialStore = new Map<string, any>();
const costLayerStore = new Map<string, any>();
const journalStore = new Map<string, any>();
const journalLineStore: any[] = [];

jest.mock("../../../src/infrastructure/database/prisma", () => {
  const mockTx = {
    barcodeAssignmentModel: {
      deleteMany: jest.fn(async (args: any) => {
        const vId = args.where.variantId;
        for (let i = barcodeStore.length - 1; i >= 0; i--) {
          if (barcodeStore[i].variantId === vId) {
            barcodeStore.splice(i, 1);
          }
        }
      }),
      createMany: jest.fn(async (args: any) => {
        for (const item of args.data) {
          barcodeStore.push({ ...item });
        }
      }),
    },
    serializedItemModel: {
      upsert: jest.fn(async (args: any) => {
        const id = args.where.id;
        const existing = serialStore.get(id) || {};
        const updated = { transitions: [], ...existing, ...(args.create || {}), ...(args.update || {}) };
        serialStore.set(id, updated);
        return updated;
      }),
    },
    statusTransitionModel: {
      deleteMany: jest.fn(async () => {}),
      createMany: jest.fn(async () => {}),
    },
    inventoryCostLayerModel: {
      upsert: jest.fn(async (args: any) => {
        const id = args.where.id;
        const existing = costLayerStore.get(id) || {};
        const updated = { ...existing, ...(args.create || {}), ...(args.update || {}) };
        costLayerStore.set(id, updated);
        return updated;
      }),
    },
    journalEntryModel: {
      upsert: jest.fn(async (args: any) => {
        const id = args.where.id;
        const existing = journalStore.get(id) || {};
        const updated = { ...existing, ...(args.create || {}), ...(args.update || {}) };
        journalStore.set(id, updated);
        return updated;
      }),
    },
    journalLineModel: {
      deleteMany: jest.fn(async (args: any) => {
        const id = args.where.journalEntryId;
        for (let i = journalLineStore.length - 1; i >= 0; i--) {
          if (journalLineStore[i].journalEntryId === id) {
            journalLineStore.splice(i, 1);
          }
        }
      }),
      createMany: jest.fn(async (args: any) => {
        for (const line of args.data) {
          journalLineStore.push({ ...line });
        }
      }),
    },
  };

  return {
    prisma: {
      statusTransitionModel: { deleteMany: jest.fn() },
      serializedItemModel: {
        deleteMany: jest.fn(),
        findUnique: jest.fn(async (args: any) => {
          let item = null;
          if (args?.where?.serialNumber_tenantId) {
            const { serialNumber, tenantId } = args.where.serialNumber_tenantId;
            item = Array.from(serialStore.values()).find(s => s.serialNumber === serialNumber && s.tenantId === tenantId) || null;
          } else {
            item = serialStore.get(args?.where?.id) || null;
          }
          if (item && !item.transitions) {
            item.transitions = [];
          }
          return item;
        }),
      },
      barcodeAssignmentModel: {
        deleteMany: jest.fn(),
        findMany: jest.fn(async (args: any) => {
          return barcodeStore.filter(b => b.variantId === args?.where?.variantId);
        }),
        findUnique: jest.fn(async (args: any) => {
          return barcodeStore.find(b => b.barcodeValue === args?.where?.barcodeValue) || null;
        }),
      },
      inventoryCostLayerModel: {
        deleteMany: jest.fn(),
        upsert: jest.fn(async (args: any) => {
          const id = args.where.id;
          const existing = costLayerStore.get(id) || {};
          const updated = { ...existing, ...(args.create || {}), ...(args.update || {}) };
          costLayerStore.set(id, updated);
          return updated;
        }),
        findMany: jest.fn(async (args: any) => {
          const results = Array.from(costLayerStore.values()).filter(c => c.variantId === args?.where?.variantId && c.remainingQuantity > 0);
          return results.sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
        }),
      },
      journalLineModel: { deleteMany: jest.fn() },
      journalEntryModel: {
        deleteMany: jest.fn(),
        findMany: jest.fn(async () => {
          return Array.from(journalStore.values()).map(entry => ({
            ...entry,
            lines: journalLineStore.filter(l => l.journalEntryId === entry.id)
          }));
        }),
      },
      kitComponentModel: { deleteMany: jest.fn() },
      kitModel: { deleteMany: jest.fn() },
      $transaction: jest.fn(async (callback: any) => {
        return callback(mockTx);
      }),
      $disconnect: jest.fn(),
    },
    pool: {
      end: jest.fn(),
    },
  };
});

import { PrismaBarcodeRepository } from "../../../src/infrastructure/database/PrismaBarcodeRepository";
import { PrismaSerializedItemRepository } from "../../../src/infrastructure/database/PrismaSerializedItemRepository";
import { PrismaCostLayerRepository } from "../../../src/infrastructure/database/PrismaCostLayerRepository";
import { PrismaJournalRepository } from "../../../src/infrastructure/database/PrismaJournalRepository";

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

describe("Prisma Repositories Integration Unit Tests", () => {
  let barcodeRepo: PrismaBarcodeRepository;
  let serialRepo: PrismaSerializedItemRepository;
  let costLayerRepo: PrismaCostLayerRepository;
  let journalRepo: PrismaJournalRepository;

  beforeAll(() => {
    barcodeRepo = new PrismaBarcodeRepository();
    serialRepo = new PrismaSerializedItemRepository();
    costLayerRepo = new PrismaCostLayerRepository();
    journalRepo = new PrismaJournalRepository();
  });

  beforeEach(() => {
    barcodeStore.length = 0;
    serialStore.clear();
    costLayerStore.clear();
    journalStore.clear();
    journalLineStore.length = 0;
    jest.clearAllMocks();
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

      item.receive(locationId, "actor-admin", "PO-999");
      expect(item.status).toBe(SerializedItemStatus.InStock);

      await serialRepo.save(item);

      const retrieved = await serialRepo.findBySerial(serialNumber, tenantId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(id);
      expect(retrieved?.status).toBe(SerializedItemStatus.InStock);

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
        500,
        new Date("2026-01-01"),
        "PO-OLD"
      );

      const layerNewer = new InventoryCostLayer(
        "L-NEW",
        variantId,
        tenantId,
        5,
        600,
        new Date("2026-02-01"),
        "PO-NEW"
      );

      await costLayerRepo.save(layerOlder);
      await costLayerRepo.save(layerNewer);

      layerOlder.consume(3);
      await costLayerRepo.save(layerOlder);

      const activeLayers = await costLayerRepo.getActiveLayers(variantId, "asc");
      expect(activeLayers.length).toBe(2);

      expect(activeLayers[0].id).toBe("L-OLD");
      expect(activeLayers[0].remainingQuantity).toBe(7);

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

      entry.addLine(AccountCode.inventory(), 5000, DebitCredit.Debit, "Debit inventory asset");
      entry.addLine(AccountCode.accountsPayable(), 5000, DebitCredit.Credit, "Credit accounts payable liability");

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
