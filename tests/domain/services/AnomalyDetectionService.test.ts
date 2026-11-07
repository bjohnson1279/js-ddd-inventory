jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    inventoryAuditModel: {
      findMany: jest.fn(),
    },
    rfidTagModel: {
      findMany: jest.fn(),
    },
    complianceLedgerModel: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from "../../../src/infrastructure/database/prisma";
import { AnomalyDetectionService } from "../../../src/domain/services/AnomalyDetectionService";
import { Logger } from "../../../src/infrastructure/logging/logger";

describe("AnomalyDetectionService Unit Tests", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it("should initialize sidecarUrl with default fallback when PYTHON_SIDECAR_URL is not set", async () => {
    delete process.env.PYTHON_SIDECAR_URL;
    const service = new AnomalyDetectionService();

    (prisma.inventoryAuditModel.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.rfidTagModel.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.complianceLedgerModel.findMany as jest.Mock).mockResolvedValue([]);

    const mockResponse = { anomalies: [] };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      send: jest.fn().mockResolvedValue(mockResponse),
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await service.analyze("tenant-default");

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:5005/anomaly-detect",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledger_entries: [],
          cycle_counts: [],
          scan_events: [],
        }),
      })
    );
  });

  it("should query audits, RFID tags, and compliance ledgers and send properly mapped payloads to sidecar", async () => {
    process.env.PYTHON_SIDECAR_URL = "http://sidecar.internal:8000";
    const service = new AnomalyDetectionService();

    const auditDate = new Date("2026-03-30T10:00:00.000Z");
    const tagDate1 = new Date("2026-03-30T09:00:00.000Z");
    const tagDate2 = new Date("2026-03-30T08:00:00.000Z");
    const ledgerDate = new Date("2026-03-30T07:00:00.000Z");

    (prisma.inventoryAuditModel.findMany as jest.Mock).mockResolvedValue([
      {
        locationId: "LOC-NORTH",
        updatedAt: auditDate,
        items: [
          {
            variantId: "SKU-COUNTED-1",
            isCounted: true,
            expectedQuantity: 20,
            countedQuantity: 18,
          },
          {
            variantId: "SKU-NOT-COUNTED",
            isCounted: false,
            expectedQuantity: 50,
            countedQuantity: null,
          },
        ],
      },
    ]);

    (prisma.rfidTagModel.findMany as jest.Mock).mockResolvedValue([
      {
        sku: "SKU-RFID-1",
        lastLocation: "DOCK-1",
        status: "PRESENT",
        lastSeenAt: tagDate1,
        createdAt: tagDate2,
      },
      {
        sku: "SKU-RFID-2",
        lastLocation: null,
        status: "MISSING",
        lastSeenAt: null,
        createdAt: tagDate2,
      },
    ]);

    (prisma.complianceLedgerModel.findMany as jest.Mock).mockResolvedValue([
      {
        id: "ledger-1",
        eventType: "STOCK_ADJUSTMENT",
        timestamp: ledgerDate,
        payload: JSON.stringify({
          sku: "SKU-LEDGER-1",
          locationId: "BIN-12",
          quantity: 5,
          reason: "DAMAGED",
          actorId: "user-42",
        }),
      },
      {
        id: "ledger-2",
        eventType: "CYCLE_COUNT_GAIN",
        timestamp: ledgerDate,
        payload: JSON.stringify({
          quantity: 2,
        }),
      },
      {
        id: "ledger-3",
        eventType: "ZERO_QTY_ENTRY",
        timestamp: ledgerDate,
        payload: JSON.stringify({
          quantity: 0,
        }),
      },
      {
        id: "ledger-4",
        eventType: "INVALID_JSON",
        timestamp: ledgerDate,
        payload: "{ invalid-json",
      },
    ]);

    const mockSidecarOutput = {
      anomalies: [
        { sku: "SKU-COUNTED-1", score: 0.85, type: "DISCREPANCY" },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      send: jest.fn().mockResolvedValue(mockSidecarOutput),
      json: jest.fn().mockResolvedValue(mockSidecarOutput),
    });

    const result = await service.analyze("tenant-100");

    expect(prisma.inventoryAuditModel.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-100" },
      include: { items: true },
      take: 100,
      orderBy: { createdAt: "desc" },
    });

    expect(prisma.rfidTagModel.findMany).toHaveBeenCalledWith({
      take: 100,
      orderBy: { createdAt: "desc" },
    });

    expect(prisma.complianceLedgerModel.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-100" },
      take: 100,
      orderBy: { timestamp: "desc" },
    });

    expect(result).toEqual(mockSidecarOutput);

    const expectedPayload = {
      ledger_entries: [
        {
          sku: "SKU-LEDGER-1",
          location_id: "BIN-12",
          quantity: 5,
          reason: "DAMAGED",
          actor_id: "user-42",
          occurred_at: ledgerDate.toISOString(),
          reference_id: "ledger-1",
        },
        {
          sku: "unknown",
          location_id: "unknown",
          quantity: 2,
          reason: "CYCLE_COUNT_GAIN",
          actor_id: "system",
          occurred_at: ledgerDate.toISOString(),
          reference_id: "ledger-2",
        },
      ],
      cycle_counts: [
        {
          sku: "SKU-COUNTED-1",
          location_id: "LOC-NORTH",
          expected_quantity: 20,
          counted_quantity: 18,
          counted_at: auditDate.toISOString(),
          actor_id: "system",
        },
      ],
      scan_events: [
        {
          sku: "SKU-RFID-1",
          location_id: "DOCK-1",
          scan_context: "PRESENT",
          scanned_at: tagDate1.toISOString(),
          actor_id: "system",
        },
        {
          sku: "SKU-RFID-2",
          location_id: "unknown",
          scan_context: "MISSING",
          scanned_at: tagDate2.toISOString(),
          actor_id: "system",
        },
      ],
    };

    expect(global.fetch).toHaveBeenCalledWith(
      "http://sidecar.internal:8000/anomaly-detect",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expectedPayload),
      }
    );
  });

  it("should handle audit items with missing countedQuantity defaulting to 0", async () => {
    const service = new AnomalyDetectionService();
    const auditDate = new Date("2026-03-30T10:00:00.000Z");

    (prisma.inventoryAuditModel.findMany as jest.Mock).mockResolvedValue([
      {
        locationId: "LOC-ZONE-A",
        updatedAt: auditDate,
        items: [
          {
            variantId: "SKU-NO-COUNT-VAL",
            isCounted: true,
            expectedQuantity: 10,
            countedQuantity: null,
          },
        ],
      },
    ]);
    (prisma.rfidTagModel.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.complianceLedgerModel.findMany as jest.Mock).mockResolvedValue([]);

    const mockOutput = { status: "success" };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      send: jest.fn().mockResolvedValue(mockOutput),
      json: jest.fn().mockResolvedValue(mockOutput),
    });

    const result = await service.analyze("tenant-null-count");
    expect(result).toEqual(mockOutput);

    const fetchBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(fetchBody.cycle_counts).toEqual([
      {
        sku: "SKU-NO-COUNT-VAL",
        location_id: "LOC-ZONE-A",
        expected_quantity: 10,
        counted_quantity: 0,
        counted_at: auditDate.toISOString(),
        actor_id: "system",
      },
    ]);
  });

  it("should log error and throw 'Failed to detect anomalies' when sidecar returns non-ok HTTP status", async () => {
    const service = new AnomalyDetectionService();

    (prisma.inventoryAuditModel.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.rfidTagModel.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.complianceLedgerModel.findMany as jest.Mock).mockResolvedValue([]);

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    const loggerErrorSpy = jest.spyOn(Logger, "error").mockImplementation();

    await expect(service.analyze("tenant-fail")).rejects.toThrow("Failed to detect anomalies");

    expect(loggerErrorSpy).toHaveBeenCalledWith({
      context: "AnomalyDetectionService",
      message: "HTTP error! status: 503",
    });

    loggerErrorSpy.mockRestore();
  });

  it("should log error and throw 'Failed to detect anomalies' when fetch throws network error", async () => {
    const service = new AnomalyDetectionService();

    (prisma.inventoryAuditModel.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.rfidTagModel.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.complianceLedgerModel.findMany as jest.Mock).mockResolvedValue([]);

    global.fetch = jest.fn().mockRejectedValue(new Error("Connection refused"));

    const loggerErrorSpy = jest.spyOn(Logger, "error").mockImplementation();

    await expect(service.analyze("tenant-conn-err")).rejects.toThrow("Failed to detect anomalies");

    expect(loggerErrorSpy).toHaveBeenCalledWith({
      context: "AnomalyDetectionService",
      message: "Connection refused",
    });

    loggerErrorSpy.mockRestore();
  });

  it("should log error and throw 'Failed to detect anomalies' when database query fails", async () => {
    const service = new AnomalyDetectionService();

    (prisma.inventoryAuditModel.findMany as jest.Mock).mockRejectedValue(
      new Error("Prisma connection pool timeout")
    );

    const loggerErrorSpy = jest.spyOn(Logger, "error").mockImplementation();

    await expect(service.analyze("tenant-db-err")).rejects.toThrow("Failed to detect anomalies");

    expect(loggerErrorSpy).toHaveBeenCalledWith({
      context: "AnomalyDetectionService",
      message: "Prisma connection pool timeout",
    });

    loggerErrorSpy.mockRestore();
  });
});
