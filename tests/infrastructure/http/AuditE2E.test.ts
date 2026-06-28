process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "dummy_test_secret";
process.env.SHOPIFY_SHOP_URL = "mock-shop.myshopify.com";
process.env.SHOPIFY_ACCESS_TOKEN = "mock-token";
process.env.QUICKBOOKS_ACCESS_TOKEN = "mock-qbo-token";

import request from "supertest";
import { app } from "../../../src/index";
import { prisma } from "../../../src/infrastructure/database/prisma";
import jwt from "jsonwebtoken";

jest.mock("../../../src/infrastructure/database/prisma", () => {
  return {
    prisma: {
      productVariantModel: {
        findMany: jest.fn(),
        findUnique: jest.fn()
      },
      ledgerEntryModel: {
        aggregate: jest.fn()
      },
      journalEntryModel: {
        findMany: jest.fn()
      },
      quickbooksJournalMappingModel: {
        findUnique: jest.fn()
      },
      xeroJournalMappingModel: {
        findUnique: jest.fn()
      },
      netsuiteJournalMappingModel: {
        findUnique: jest.fn()
      },
      auditDiscrepancyModel: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    }
  };
});

describe("Audit REST API Endpoints", () => {
  let token: string;

  beforeAll(() => {
    token = jwt.sign(
      { tenantId: "tenant-1", actorId: "admin-actor", role: "admin" },
      process.env.JWT_SECRET || ""
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should list discrepancies", async () => {
    const mockDiscrepancy = {
      id: "disc-1",
      tenantId: "tenant-1",
      type: "SHOPIFY_STOCK_MISMATCH",
      referenceId: "SKU-A:LOC-A",
      externalRefId: "ext-1",
      description: "Stock mismatch description",
      status: "OPEN",
      occurredAt: new Date()
    };
    (prisma.auditDiscrepancyModel.findMany as jest.Mock).mockResolvedValueOnce([mockDiscrepancy]);

    const res = await request(app)
      .get("/api/audit/discrepancies")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.discrepancies).toHaveLength(1);
    expect(res.body.discrepancies[0].id).toBe("disc-1");
  });

  it("should run audit and report discrepancies", async () => {
    // 1. Mock variant mapping
    (prisma.productVariantModel.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "var-1", sku: "SKU-DIFF" } // ends with -DIFF to mock Shopify mismatch
    ]);

    // 2. Mock ledger aggregate local quantities
    (prisma.ledgerEntryModel.aggregate as jest.Mock).mockResolvedValueOnce({
      _sum: { quantity: 10 }
    });

    // 3. Mock open check findFirst
    (prisma.auditDiscrepancyModel.findFirst as jest.Mock)
      .mockResolvedValueOnce(null) // no existing Shopify discrepancy
      .mockResolvedValueOnce(null); // no existing accounting discrepancy

    // 4. Mock recent journal entries
    (prisma.journalEntryModel.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "je-1", tenantId: "tenant-1", description: "Journal 1", entryDate: new Date() }
    ]);

    // 5. Mock mapping check
    (prisma.quickbooksJournalMappingModel.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/api/audit/run")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.shopifyDiscrepancies).toBe(1);
    expect(res.body.accountingDiscrepancies).toBe(1);

    expect(prisma.auditDiscrepancyModel.create).toHaveBeenCalledTimes(2);
  });

  it("should resolve discrepancy", async () => {
    (prisma.auditDiscrepancyModel.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "disc-1",
      tenantId: "tenant-1",
      type: "ACCOUNTING_JOURNAL_MISSING",
      referenceId: "je-1",
      status: "OPEN"
    });

    const res = await request(app)
      .post("/api/audit/discrepancies/disc-1/resolve")
      .set("Authorization", `Bearer ${token}`)
      .send({ notes: "Manually synchronized" })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(prisma.auditDiscrepancyModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "disc-1" },
        data: expect.objectContaining({
          status: "RESOLVED",
          resolutionNotes: "Manually synchronized"
        })
      })
    );
  });
});
