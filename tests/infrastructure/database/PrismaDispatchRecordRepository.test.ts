import { PrismaDispatchRecordRepository } from "../../../src/infrastructure/database/PrismaDispatchRecordRepository";
import { DispatchRecord } from "../../../src/domain/repositories/IDispatchRecordRepository";
import { prisma as sharedPrisma } from "../../../src/infrastructure/database/prisma";

jest.mock("../../../src/infrastructure/database/prisma", () => {
  return {
    prisma: {
      dispatchRecordModel: {
        create: jest.fn(),
        findMany: jest.fn(),
      }
    }
  };
});

describe("PrismaDispatchRecordRepository", () => {
  let repo: PrismaDispatchRecordRepository;

  beforeEach(() => {
    repo = new PrismaDispatchRecordRepository();
    jest.clearAllMocks();
  });

  it("should save a record", async () => {
    const record = new DispatchRecord("id-1", "SKU123", "LOC1", 10, new Date("2024-01-01"), "LOT-A");
    await repo.save(record);

    expect(sharedPrisma.dispatchRecordModel.create).toHaveBeenCalledWith({
      data: {
        sku: "SKU123",
        locationId: "LOC1",
        quantity: 10,
        dispatchedAt: expect.any(Date),
        lotNumber: "LOT-A"
      }
    });
  });

  it("should save a record with explicit tx", async () => {
    const tx = {
      dispatchRecordModel: {
        create: jest.fn()
      }
    };

    const record = new DispatchRecord("id-1", "SKU123", "LOC1", 10, new Date("2024-01-01"));
    await repo.save(record, tx);

    expect(tx.dispatchRecordModel.create).toHaveBeenCalledWith({
      data: {
        sku: "SKU123",
        locationId: "LOC1",
        quantity: 10,
        dispatchedAt: expect.any(Date),
        lotNumber: null
      }
    });
    expect(sharedPrisma.dispatchRecordModel.create).not.toHaveBeenCalled();
  });

  it("should fetch history", async () => {
    const date = new Date("2024-01-01");
    (sharedPrisma.dispatchRecordModel.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "id-1", sku: "SKU123", locationId: "LOC1", quantity: 10, dispatchedAt: date, lotNumber: "LOT-A" }
    ]);

    const records = await repo.fetchHistory("SKU123", "LOC1", new Date("2023-01-01"));

    expect(sharedPrisma.dispatchRecordModel.findMany).toHaveBeenCalledWith({
      where: {
        sku: "SKU123",
        locationId: "LOC1",
        dispatchedAt: {
          gte: expect.any(Date)
        }
      },
      orderBy: { dispatchedAt: "asc" }
    });

    expect(records.length).toBe(1);
    expect(records[0]).toBeInstanceOf(DispatchRecord);
    expect(records[0].id).toBe("id-1");
  });

  it("should fetch by lot number", async () => {
    const date = new Date("2024-01-01");
    (sharedPrisma.dispatchRecordModel.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "id-1", sku: "SKU123", locationId: "LOC1", quantity: 10, dispatchedAt: date, lotNumber: "LOT-B" }
    ]);

    const records = await repo.fetchByLotNumber("LOT-B");

    expect(sharedPrisma.dispatchRecordModel.findMany).toHaveBeenCalledWith({
      where: {
        lotNumber: "LOT-B"
      },
      orderBy: { dispatchedAt: "desc" }
    });

    expect(records.length).toBe(1);
    expect(records[0]).toBeInstanceOf(DispatchRecord);
    expect(records[0].lotNumber).toBe("LOT-B");
  });
});
