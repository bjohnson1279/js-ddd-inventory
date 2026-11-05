import { prisma } from "../../../src/infrastructure/database/prisma";
import { AuditProcessorService } from "../../../src/domain/services/AuditProcessorService";
import { Logger } from "../../../src/infrastructure/logging/logger";

jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    productVariantModel: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    inventoryModel: {
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    journalEntryModel: {
      findMany: jest.fn(),
    },
    quickbooksJournalMappingModel: {
      findMany: jest.fn(),
    },
    xeroJournalMappingModel: {
      findMany: jest.fn(),
    },
    netsuiteJournalMappingModel: {
      findMany: jest.fn(),
    },
    auditDiscrepancyModel: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("AuditProcessorService Unit Tests", () => {
  let service: AuditProcessorService;
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    service = new AuditProcessorService();
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe("Shopify Stock Level Audit", () => {
    it("should bypass Shopify audit if store domain or access token are missing", async () => {
      delete process.env.SHOPIFY_SHOP_URL;
      delete process.env.SHOPIFY_ACCESS_TOKEN;
      delete process.env.QUICKBOOKS_ACCESS_TOKEN;
      delete process.env.XERO_ACCESS_TOKEN;
      delete process.env.NETSUITE_ACCESS_TOKEN;

      const result = await service.runAudit("tenant-1");

      expect(result).toEqual({ shopifyDiscrepancies: 0, accountingDiscrepancies: 0 });
      expect(prisma.productVariantModel.findMany).not.toHaveBeenCalled();
    });

    it("should handle live Shopify GraphQL querying with escaping, chunking, and mismatch detection", async () => {
      process.env.SHOPIFY_SHOP_URL = "test-store.myshopify.com";
      process.env.SHOPIFY_ACCESS_TOKEN = "real-token-123";
      process.env.SHOPIFY_LOCATION_ID = "gid://shopify/Location/loc-1";
      delete process.env.QUICKBOOKS_ACCESS_TOKEN;
      delete process.env.XERO_ACCESS_TOKEN;
      delete process.env.NETSUITE_ACCESS_TOKEN;

      (prisma.productVariantModel.findMany as jest.Mock).mockResolvedValue([
        { sku: 'SKU"QUOTE\\SLASH' },
        { sku: "SKU-MATCH" },
      ]);

      (prisma.inventoryModel.groupBy as jest.Mock).mockResolvedValue([
        { sku: 'SKU"QUOTE\\SLASH', _sum: { quantity: 15 } },
        { sku: "SKU-MATCH", _sum: { quantity: 20 } },
      ]);

      (prisma.auditDiscrepancyModel.findMany as jest.Mock).mockResolvedValue([]);

      const mockData = {
        data: {
          var0: {
            edges: [
              {
                node: {
                  id: "gid://shopify/InventoryItem/1",
                  inventoryLevels: {
                    edges: [
                      {
                        node: {
                          location: { id: "gid://shopify/Location/loc-1" },
                          quantities: [{ quantity: 5 }],
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
          var1: {
            edges: [
              {
                node: {
                  id: "gid://shopify/InventoryItem/2",
                  inventoryLevels: {
                    edges: [
                      {
                        node: {
                          location: { id: "gid://shopify/Location/loc-1" },
                          quantities: [{ quantity: 20 }],
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      const mockFetchResponse = {
        ok: true,
        send: jest.fn().mockResolvedValue(mockData),
        json: jest.fn().mockResolvedValue(mockData),
      };
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

      const result = await service.runAudit("tenant-1");

      expect(result.shopifyDiscrepancies).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://test-store.myshopify.com/admin/api/2024-04/graphql.json",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": "real-token-123",
          },
        })
      );

      const fetchCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(fetchCallBody.query).toContain('var0: inventoryItems(first: 1, query: "sku:SKU\\"QUOTE\\\\SLASH")');

      expect(prisma.auditDiscrepancyModel.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            tenantId: "tenant-1",
            type: "SHOPIFY_STOCK_MISMATCH",
            referenceId: 'SKU"QUOTE\\SLASH:default',
            description: expect.stringContaining("Local: 15, Shopify: 5"),
          }),
        ],
      });
    });

    it("should gracefully handle Shopify GraphQL request failure and log an error", async () => {
      process.env.SHOPIFY_SHOP_URL = "test-store.myshopify.com";
      process.env.SHOPIFY_ACCESS_TOKEN = "real-token-123";
      delete process.env.QUICKBOOKS_ACCESS_TOKEN;
      delete process.env.XERO_ACCESS_TOKEN;
      delete process.env.NETSUITE_ACCESS_TOKEN;

      const loggerErrorSpy = jest.spyOn(Logger, "error").mockImplementation();

      (prisma.productVariantModel.findMany as jest.Mock).mockResolvedValue([
        { sku: "SKU-ERROR" },
      ]);
      (prisma.inventoryModel.groupBy as jest.Mock).mockResolvedValue([
        { sku: "SKU-ERROR", _sum: { quantity: 10 } },
      ]);
      (prisma.auditDiscrepancyModel.findMany as jest.Mock).mockResolvedValue([]);

      global.fetch = jest.fn().mockRejectedValue(new Error("Network timeout"));

      const result = await service.runAudit("tenant-1");

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          context: "AuditProcessorService",
          message: "Failed to query Shopify stock level:",
        })
      );
      // Because shopifyStockMap is empty, shopifyQty falls back to localQty, resulting in 0 discrepancies
      expect(result.shopifyDiscrepancies).toBe(0);
      expect(prisma.auditDiscrepancyModel.createMany).not.toHaveBeenCalled();

      loggerErrorSpy.mockRestore();
    });

    it("should avoid duplicate discrepancies when an open discrepancy already exists", async () => {
      process.env.SHOPIFY_SHOP_URL = "mock-store.myshopify.com";
      process.env.SHOPIFY_ACCESS_TOKEN = "mock-token";
      delete process.env.QUICKBOOKS_ACCESS_TOKEN;
      delete process.env.XERO_ACCESS_TOKEN;
      delete process.env.NETSUITE_ACCESS_TOKEN;

      (prisma.productVariantModel.findMany as jest.Mock).mockResolvedValue([
        { sku: "SKU-DIFF" },
      ]);
      (prisma.inventoryModel.groupBy as jest.Mock).mockResolvedValue([
        { sku: "SKU-DIFF", _sum: { quantity: 5 } },
      ]);
      // Existing open discrepancy for SKU-DIFF:default
      (prisma.auditDiscrepancyModel.findMany as jest.Mock).mockResolvedValue([
        { referenceId: "SKU-DIFF:default", status: "OPEN" },
      ]);

      const result = await service.runAudit("tenant-1");

      expect(result.shopifyDiscrepancies).toBe(0);
      expect(prisma.auditDiscrepancyModel.createMany).not.toHaveBeenCalled();
    });
  });

  describe("Accounting Sync Audit", () => {
    it("should check mappings against QuickBooks, Xero, and NetSuite and report missing ones", async () => {
      delete process.env.SHOPIFY_SHOP_URL;
      delete process.env.SHOPIFY_ACCESS_TOKEN;
      process.env.QUICKBOOKS_ACCESS_TOKEN = "qbo-token";
      process.env.XERO_ACCESS_TOKEN = "xero-token";
      process.env.NETSUITE_ACCESS_TOKEN = "netsuite-token";

      (prisma.journalEntryModel.findMany as jest.Mock).mockResolvedValue([
        { id: "je-1", tenantId: "tenant-1", description: "Journal QBO", entryDate: new Date() },
        { id: "je-2", tenantId: "tenant-1", description: "Journal Xero", entryDate: new Date() },
        { id: "je-3", tenantId: "tenant-1", description: "Journal NetSuite", entryDate: new Date() },
        { id: "je-4", tenantId: "tenant-1", description: "Unmapped Journal", entryDate: new Date() },
      ]);

      (prisma.quickbooksJournalMappingModel.findMany as jest.Mock).mockResolvedValue([
        { journalEntryId: "je-1" },
      ]);
      (prisma.xeroJournalMappingModel.findMany as jest.Mock).mockResolvedValue([
        { journalEntryId: "je-2" },
      ]);
      (prisma.netsuiteJournalMappingModel.findMany as jest.Mock).mockResolvedValue([
        { journalEntryId: "je-3" },
      ]);

      (prisma.auditDiscrepancyModel.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.runAudit("tenant-1");

      expect(result.accountingDiscrepancies).toBe(1);
      expect(prisma.auditDiscrepancyModel.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            tenantId: "tenant-1",
            type: "ACCOUNTING_JOURNAL_MISSING",
            referenceId: "je-4",
            description: expect.stringContaining("Journal entry je-4 (Unmapped Journal) is not mapped"),
          }),
        ],
      });
    });

    it("should not create duplicate discrepancies if journal discrepancy is already open", async () => {
      delete process.env.SHOPIFY_SHOP_URL;
      delete process.env.SHOPIFY_ACCESS_TOKEN;
      process.env.QUICKBOOKS_ACCESS_TOKEN = "qbo-token";

      (prisma.journalEntryModel.findMany as jest.Mock).mockResolvedValue([
        { id: "je-missing", tenantId: "tenant-1", description: undefined, entryDate: new Date() },
      ]);
      (prisma.quickbooksJournalMappingModel.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditDiscrepancyModel.findMany as jest.Mock).mockResolvedValue([
        { referenceId: "je-missing", status: "OPEN" },
      ]);

      const result = await service.runAudit("tenant-1");

      expect(result.accountingDiscrepancies).toBe(0);
      expect(prisma.auditDiscrepancyModel.createMany).not.toHaveBeenCalled();
    });
  });

  describe("resolveDiscrepancy", () => {
    it("should return false if discrepancy is not found or already RESOLVED", async () => {
      (prisma.auditDiscrepancyModel.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "disc-1", status: "RESOLVED" });

      const resNotFound = await service.resolveDiscrepancy("tenant-1", "disc-1", "Notes");
      expect(resNotFound).toBe(false);

      const resResolved = await service.resolveDiscrepancy("tenant-1", "disc-1", "Notes");
      expect(resResolved).toBe(false);

      expect(prisma.auditDiscrepancyModel.update).not.toHaveBeenCalled();
    });

    it("should resolve a non-Shopify discrepancy successfully without calling external API", async () => {
      (prisma.auditDiscrepancyModel.findFirst as jest.Mock).mockResolvedValue({
        id: "disc-acc",
        tenantId: "tenant-1",
        type: "ACCOUNTING_JOURNAL_MISSING",
        referenceId: "je-1",
        status: "OPEN",
      });

      const res = await service.resolveDiscrepancy("tenant-1", "disc-acc", "Manually synced in QBO");

      expect(res).toBe(true);
      expect(prisma.auditDiscrepancyModel.update).toHaveBeenCalledWith({
        where: { id: "disc-acc" },
        data: expect.objectContaining({
          status: "RESOLVED",
          resolutionNotes: "Manually synced in QBO",
        }),
      });
      expect(prisma.productVariantModel.findUnique).not.toHaveBeenCalled();
    });

    it("should push updated stock level to Shopify when resolving SHOPIFY_STOCK_MISMATCH", async () => {
      process.env.SHOPIFY_SHOP_URL = "test-store.myshopify.com";
      process.env.SHOPIFY_ACCESS_TOKEN = "real-token-123";
      process.env.SHOPIFY_LOCATION_ID = "gid://shopify/Location/loc-1";

      (prisma.auditDiscrepancyModel.findFirst as jest.Mock).mockResolvedValue({
        id: "disc-shopify",
        tenantId: "tenant-1",
        type: "SHOPIFY_STOCK_MISMATCH",
        referenceId: "SKU-RESOLVE:default",
        externalRefId: "gid://shopify/InventoryItem/999",
        status: "OPEN",
      });

      (prisma.productVariantModel.findUnique as jest.Mock).mockResolvedValue({
        id: "var-1",
        sku: "SKU-RESOLVE",
      });

      (prisma.inventoryModel.aggregate as jest.Mock).mockResolvedValue({
        _sum: { quantity: 42 },
      });

      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      const res = await service.resolveDiscrepancy("tenant-1", "disc-shopify", "Fixed discrepancy");

      expect(res).toBe(true);
      expect(prisma.auditDiscrepancyModel.update).toHaveBeenCalledWith({
        where: { id: "disc-shopify" },
        data: expect.objectContaining({
          status: "RESOLVED",
          resolutionNotes: "Fixed discrepancy",
        }),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test-store.myshopify.com/admin/api/2024-04/graphql.json",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": "real-token-123",
          },
          body: expect.stringContaining('"inventoryItemId":"gid://shopify/InventoryItem/999"'),
        })
      );

      const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(requestBody.variables.input.setQuantities[0]).toEqual({
        inventoryItemId: "gid://shopify/InventoryItem/999",
        locationId: "gid://shopify/Location/loc-1",
        quantity: 42,
      });
    });

    it("should log error and still return true if Shopify API push throws during resolution", async () => {
      process.env.SHOPIFY_SHOP_URL = "test-store.myshopify.com";
      process.env.SHOPIFY_ACCESS_TOKEN = "real-token-123";

      const loggerErrorSpy = jest.spyOn(Logger, "error").mockImplementation();

      (prisma.auditDiscrepancyModel.findFirst as jest.Mock).mockResolvedValue({
        id: "disc-err",
        tenantId: "tenant-1",
        type: "SHOPIFY_STOCK_MISMATCH",
        referenceId: "SKU-FAIL:default",
        externalRefId: "inv-item-fail",
        status: "OPEN",
      });

      (prisma.productVariantModel.findUnique as jest.Mock).mockResolvedValue({
        id: "var-err",
        sku: "SKU-FAIL",
      });

      (prisma.inventoryModel.aggregate as jest.Mock).mockResolvedValue({
        _sum: { quantity: null },
      });

      global.fetch = jest.fn().mockRejectedValue(new Error("Shopify mutation error"));

      const res = await service.resolveDiscrepancy("tenant-1", "disc-err", "Resolved with api fail");

      expect(res).toBe(true);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          context: "AuditProcessorService",
          message: "Failed to resolve Shopify discrepancy by pushing correct stock:",
        })
      );

      loggerErrorSpy.mockRestore();
    });
  });
});
