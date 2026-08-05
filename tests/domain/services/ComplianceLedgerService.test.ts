import { prisma } from "../../../src/infrastructure/database/prisma";
import crypto from "crypto";

jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    complianceLedgerModel: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn()
    }
  }
}));

jest.mock("../../../src/infrastructure/logging/logger", () => ({
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
  }
}));

describe("ComplianceLedgerService", () => {
  const originalEnv = process.env;
  let ComplianceLedgerService: any;

  beforeEach(async () => {
    process.env = { ...originalEnv, COMPLIANCE_PRIVATE_KEY: "test-secret-key" };
    jest.clearAllMocks();
    jest.resetModules();

    // Require module after reset so we get a fresh inMemoryLedger
    const module = await import("../../../src/domain/services/ComplianceLedgerService");
    ComplianceLedgerService = module.ComplianceLedgerService;

    // Prisma mocks
    const prismaModule = await import("../../../src/infrastructure/database/prisma");
    (prismaModule.prisma.complianceLedgerModel.findFirst as jest.Mock).mockRejectedValue(new Error("DB offline"));
    (prismaModule.prisma.complianceLedgerModel.findMany as jest.Mock).mockRejectedValue(new Error("DB offline"));
    (prismaModule.prisma.complianceLedgerModel.create as jest.Mock).mockResolvedValue({});
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Configuration & Environment", () => {
    it("should throw error if COMPLIANCE_PRIVATE_KEY is missing", async () => {
      delete process.env.COMPLIANCE_PRIVATE_KEY;
      await expect(
        ComplianceLedgerService.logEvent("tenant1", "TEST_EVENT", {})
      ).rejects.toThrow("COMPLIANCE_PRIVATE_KEY environment variable is required for security.");
    });
  });

  describe("logEvent", () => {
    it("should create a genesis block correctly", async () => {
      const entry = await ComplianceLedgerService.logEvent("tenant1", "TEST_EVENT", { qty: 10 });

      expect(entry.sequenceNumber).toBe(1);
      expect(entry.tenantId).toBe("tenant1");
      expect(entry.eventType).toBe("TEST_EVENT");
      expect(entry.previousHash).toBe("0000000000000000000000000000000000000000000000000000000000000000");
      expect(entry.hash).toBeDefined();
      expect(entry.signature).toBeDefined();

      const ledger = ComplianceLedgerService.getInMemoryLedger();
      expect(ledger.length).toBe(1);
    });

    it("should chain multiple blocks correctly", async () => {
      const entry1 = await ComplianceLedgerService.logEvent("tenant1", "EVENT_1", { qty: 10 });
      const entry2 = await ComplianceLedgerService.logEvent("tenant1", "EVENT_2", { qty: -5 });

      expect(entry2.sequenceNumber).toBe(2);
      expect(entry2.previousHash).toBe(entry1.hash);

      const ledger = ComplianceLedgerService.getInMemoryLedger();
      expect(ledger.length).toBe(2);
    });
  });

  describe("validateLedger", () => {
    it("should validate an intact ledger successfully", async () => {
      await ComplianceLedgerService.logEvent("tenant1", "EVENT_1", { data: "A" });
      await ComplianceLedgerService.logEvent("tenant1", "EVENT_2", { data: "B" });

      const result = await ComplianceLedgerService.validateLedger("tenant1");
      expect(result.isValid).toBe(true);
    });

    it("should validate an intact ledger without providing tenantId", async () => {
      await ComplianceLedgerService.logEvent("tenant1", "EVENT_1", { data: "A" });

      const result = await ComplianceLedgerService.validateLedger();
      expect(result.isValid).toBe(true);
    });

    it("should invalidate if genesis block has invalid previousHash", async () => {
      await ComplianceLedgerService.logEvent("tenant1", "EVENT_1", { data: "A" });
      const ledger = ComplianceLedgerService.getInMemoryLedger();

      // Tamper genesis previous hash
      ledger[0].previousHash = "tampered";

      const result = await ComplianceLedgerService.validateLedger("tenant1");
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Genesis block previousHash must be zero hash.");
    });

    it("should invalidate if chain is broken (previousHash mismatch)", async () => {
      await ComplianceLedgerService.logEvent("tenant1", "EVENT_1", { data: "A" });
      await ComplianceLedgerService.logEvent("tenant1", "EVENT_2", { data: "B" });

      const ledger = ComplianceLedgerService.getInMemoryLedger();
      ledger[1].previousHash = "tampered-hash";

      const result = await ComplianceLedgerService.validateLedger("tenant1");
      expect(result.isValid).toBe(false);
      expect(result.failedSequenceNumber).toBe(2);
      expect(result.reason).toContain("Chain broken:");
    });

    it("should invalidate if block payload is tampered", async () => {
      await ComplianceLedgerService.logEvent("tenant1", "EVENT_1", { data: "A" });

      const ledger = ComplianceLedgerService.getInMemoryLedger();
      ledger[0].payload = JSON.stringify({ data: "TAMPERED" });

      const result = await ComplianceLedgerService.validateLedger("tenant1");
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("recalculated hash does not match stored hash");
    });

    it("should invalidate if signature is tampered", async () => {
      await ComplianceLedgerService.logEvent("tenant1", "EVENT_1", { data: "A" });

      const ledger = ComplianceLedgerService.getInMemoryLedger();
      ledger[0].signature = "tampered-signature";

      const result = await ComplianceLedgerService.validateLedger("tenant1");
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Invalid signature:");
    });
  });

  describe("reconstructState", () => {
    it("should reconstruct stock levels from ledger events", async () => {
      await ComplianceLedgerService.logEvent("tenant1", "RECEIVE", { sku: "SKU-A", locationId: "LOC-1", quantityDelta: 50 });
      await ComplianceLedgerService.logEvent("tenant1", "PICK", { sku: "SKU-A", locationId: "LOC-1", quantityDelta: -10 });
      await ComplianceLedgerService.logEvent("tenant1", "OVERRIDE", { sku: "SKU-A", locationId: "LOC-1", quantity: 35 });

      const state = await ComplianceLedgerService.reconstructState("tenant1");

      expect(state.stockLevels).toHaveLength(1);
      expect(state.stockLevels[0].sku).toBe("SKU-A");
      expect(state.stockLevels[0].locationId).toBe("LOC-1");
      expect(state.stockLevels[0].quantity).toBe(35);
    });

    it("should reconstruct bin configurations", async () => {
      await ComplianceLedgerService.logEvent("tenant1", "CREATE_BIN", { binCode: "BIN-XYZ", maxCapacity: 200, currentCapacity: 150 });

      const state = await ComplianceLedgerService.reconstructState("tenant1");

      expect(state.binConfigurations).toHaveLength(1);
      expect(state.binConfigurations[0].binCode).toBe("BIN-XYZ");
      expect(state.binConfigurations[0].maxCapacity).toBe(200);
      expect(state.binConfigurations[0].currentCapacity).toBe(150);
    });

    it("should reconstruct account balances from multiple lines", async () => {
      await ComplianceLedgerService.logEvent("tenant1", "INVOICE", {
        lines: [
          { accountCode: "ASSET-100", debit: 500, credit: 0 },
          { accountCode: "REVENUE-200", debit: 0, credit: 500 }
        ]
      });
      await ComplianceLedgerService.logEvent("tenant1", "PAYMENT", {
        accountCode: "ASSET-100", debit: 0, credit: 100
      });

      const state = await ComplianceLedgerService.reconstructState("tenant1");

      const assetAccount = state.accountBalances.find((a: any) => a.accountCode === "ASSET-100");
      const revenueAccount = state.accountBalances.find((a: any) => a.accountCode === "REVENUE-200");

      expect(assetAccount.balance).toBe(400); // 500 - 100
      expect(revenueAccount.balance).toBe(-500);
    });

    it("should filter by timestamp if provided", async () => {
      await ComplianceLedgerService.logEvent("tenant1", "E1", { sku: "SKU-1", quantityDelta: 10 });

      const ledger = ComplianceLedgerService.getInMemoryLedger();
      const firstEventTime = new Date(ledger[0].timestamp).getTime();

      await ComplianceLedgerService.logEvent("tenant1", "E2", { sku: "SKU-1", quantityDelta: 5 });

      // Update the second event to be in the future
      const allLedger = ComplianceLedgerService.getInMemoryLedger();
      allLedger[1].timestamp = new Date(firstEventTime + 10000); // 10 seconds later

      // Reconstruct state at the exact time of the first event
      const state = await ComplianceLedgerService.reconstructState("tenant1", new Date(firstEventTime).toISOString());

      expect(state.stockLevels[0].quantity).toBe(10);
    });

    it("should reconstruct account balances from a single account code", async () => {
      await ComplianceLedgerService.logEvent("tenant1", "PAYMENT", {
        accountCode: "ASSET-100", debit: 50, credit: 0, accountName: "Bank"
      });
      await ComplianceLedgerService.logEvent("tenant1", "PAYMENT", {
        accountCode: "ASSET-100", debit: 0, credit: 20
      });
      const state = await ComplianceLedgerService.reconstructState("tenant1");
      const assetAccount = state.accountBalances.find((a: any) => a.accountCode === "ASSET-100");
      expect(assetAccount.balance).toBe(30);
    });

    it("should gracefully handle invalid payload in reconstructState", async () => {
      await ComplianceLedgerService.logEvent("tenant1", "TEST_EVENT", { qty: 10 });
      const ledger = ComplianceLedgerService.getInMemoryLedger();
      ledger[0].payload = "invalid-json{";

      const state = await ComplianceLedgerService.reconstructState("tenant1");
      expect(state.stockLevels).toHaveLength(0);
    });
  });

  describe("replayAudit", () => {
    it("should return formatted entries for audit", async () => {
      await ComplianceLedgerService.logEvent("tenant1", "AUDIT_TEST", { testData: "value" });

      const audit = await ComplianceLedgerService.replayAudit("tenant1");

      expect(audit).toHaveLength(1);
      expect(audit[0].sequenceNumber).toBe(1);
      expect(audit[0].eventType).toBe("AUDIT_TEST");
      expect(audit[0].payload.testData).toBe("value");
    });

    it("should filter replay by timestamp", async () => {
      await ComplianceLedgerService.logEvent("tenant1", "E1", { data: 1 });
      const ledger = ComplianceLedgerService.getInMemoryLedger();
      const firstEventTime = new Date(ledger[0].timestamp).getTime();

      await ComplianceLedgerService.logEvent("tenant1", "E2", { data: 2 });
      const allLedger = ComplianceLedgerService.getInMemoryLedger();
      allLedger[1].timestamp = new Date(firstEventTime + 10000); // 10 seconds later

      const audit = await ComplianceLedgerService.replayAudit("tenant1", new Date(firstEventTime).toISOString());

      expect(audit).toHaveLength(1);
      expect(audit[0].eventType).toBe("E1");
    });

    it("should fallback to original payload if JSON parsing fails during replay", async () => {
      await ComplianceLedgerService.logEvent("tenant1", "MALFORMED", { test: 1 });
      const ledger = ComplianceLedgerService.getInMemoryLedger();
      ledger[0].payload = "invalid-json{";

      const audit = await ComplianceLedgerService.replayAudit("tenant1");
      expect(audit[0].payload).toBe("invalid-json{");
    });
  });
});
