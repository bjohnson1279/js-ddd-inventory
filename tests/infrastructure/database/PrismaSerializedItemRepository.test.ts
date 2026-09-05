import { PrismaSerializedItemRepository } from "../../../src/infrastructure/database/PrismaSerializedItemRepository";
import { prisma as sharedPrisma } from "../../../src/infrastructure/database/prisma";
import { SerializedItem } from "../../../src/domain/serial/aggregates/SerializedItem";
import { SerialNumber } from "../../../src/domain/serial/valueObjects/SerialNumber";
import { SerializedItemStatus } from "../../../src/domain/serial/enums/SerializedItemStatus";
import { SerialNumberNotFoundException } from "../../../src/domain/serial/exceptions/SerialNumberNotFoundException";
import { DomainEventDispatcher } from "../../../src/domain/events/DomainEventDispatcher";
import { Prisma } from "@prisma/client";

jest.mock("../../../src/infrastructure/database/prisma", () => {
  const mockTx = {
    serializedItemModel: {
      upsert: jest.fn(),
    },
    statusTransitionModel: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    }
  };
  return {
    prisma: {
      serializedItemModel: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
      },
      statusTransitionModel: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockTx)),
    }
  };
});

jest.mock("../../../src/domain/events/DomainEventDispatcher", () => ({
  DomainEventDispatcher: {
    dispatch: jest.fn(),
  }
}));

describe("PrismaSerializedItemRepository Unit Tests", () => {
  let repo: PrismaSerializedItemRepository;

  beforeAll(() => {
    repo = new PrismaSerializedItemRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockRecord = (overrides = {}) => ({
    id: "item-1",
    sku: "SKU-1",
    serialNumber: "SN-123",
    tenantId: "t-1",
    locationId: "loc-1",
    status: SerializedItemStatus.InStock,
    transitions: [
      {
        fromStatus: SerializedItemStatus.Pending,
        toStatus: SerializedItemStatus.InStock,
        reason: "Received",
        actorId: "actor-1",
        referenceId: "ref-1",
        transitionedAt: new Date(),
      }
    ],
    ...overrides
  });

  it("should find an item by serial", async () => {
    const mockRecord = createMockRecord();
    (sharedPrisma.serializedItemModel.findUnique as jest.Mock).mockResolvedValue(mockRecord);

    const serial = new SerialNumber("SN-123");
    const item = await repo.findBySerial(serial, "t-1");

    expect(item).not.toBeNull();
    expect(item?.id).toBe("item-1");
    expect(item?.serialNumber.value).toBe("SN-123");
    expect(item?.history.length).toBe(1);
    expect(sharedPrisma.serializedItemModel.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        serialNumber_tenantId: {
          serialNumber: "SN-123",
          tenantId: "t-1",
        }
      }
    }));
  });

  it("should return null when finding by non-existent serial", async () => {
    (sharedPrisma.serializedItemModel.findUnique as jest.Mock).mockResolvedValue(null);

    const serial = new SerialNumber("SN-999");
    const item = await repo.findBySerial(serial, "t-1");

    expect(item).toBeNull();
  });

  it("should find an item by id", async () => {
    const mockRecord = createMockRecord();
    (sharedPrisma.serializedItemModel.findUnique as jest.Mock).mockResolvedValue(mockRecord);

    const item = await repo.findById("item-1");

    expect(item).not.toBeNull();
    expect(item?.id).toBe("item-1");
    expect(sharedPrisma.serializedItemModel.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "item-1" }
    }));
  });

  it("should find item by serial or fail", async () => {
    const mockRecord = createMockRecord();
    (sharedPrisma.serializedItemModel.findUnique as jest.Mock).mockResolvedValue(mockRecord);

    const serial = new SerialNumber("SN-123");
    const item = await repo.findBySerialOrFail(serial, "t-1");

    expect(item.id).toBe("item-1");
  });

  it("should throw SerialNumberNotFoundException when finding by non-existent serial or fail", async () => {
    (sharedPrisma.serializedItemModel.findUnique as jest.Mock).mockResolvedValue(null);

    const serial = new SerialNumber("SN-999");
    await expect(repo.findBySerialOrFail(serial, "t-1")).rejects.toThrow(SerialNumberNotFoundException);
  });

  it("should find items by variant", async () => {
    const mockRecord1 = createMockRecord({ id: "item-1" });
    const mockRecord2 = createMockRecord({ id: "item-2" });
    (sharedPrisma.serializedItemModel.findMany as jest.Mock).mockResolvedValue([mockRecord1, mockRecord2]);

    const items = await repo.findByVariant("SKU-1");

    expect(items.length).toBe(2);
    expect(items[0].id).toBe("item-1");
    expect(items[1].id).toBe("item-2");
    expect(sharedPrisma.serializedItemModel.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { sku: "SKU-1" }
    }));
  });

  it("should find items by variant and status", async () => {
    (sharedPrisma.serializedItemModel.findMany as jest.Mock).mockResolvedValue([]);

    await repo.findByVariant("SKU-1", SerializedItemStatus.Sold);

    expect(sharedPrisma.serializedItemModel.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { sku: "SKU-1", status: SerializedItemStatus.Sold }
    }));
  });

  it("should find items by multiple serials", async () => {
    const mockRecord = createMockRecord();
    (sharedPrisma.serializedItemModel.findMany as jest.Mock).mockResolvedValue([mockRecord]);

    const serials = [new SerialNumber("SN-123"), new SerialNumber("SN-456")];
    const items = await repo.findBySerials(serials, "t-1");

    expect(items.length).toBe(1);
    expect(sharedPrisma.serializedItemModel.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        serialNumber: { in: ["SN-123", "SN-456"] },
        tenantId: "t-1"
      }
    }));
  });

  it("should check if serial is registered", async () => {
    (sharedPrisma.serializedItemModel.findUnique as jest.Mock).mockResolvedValue({ id: "item-1" });

    const serial = new SerialNumber("SN-123");
    const isReg = await repo.isRegistered(serial, "t-1");

    expect(isReg).toBe(true);

    (sharedPrisma.serializedItemModel.findUnique as jest.Mock).mockResolvedValue(null);
    const isNotReg = await repo.isRegistered(serial, "t-1");

    expect(isNotReg).toBe(false);
  });

  it("should count items by status", async () => {
    (sharedPrisma.serializedItemModel.count as jest.Mock).mockResolvedValue(5);

    const count = await repo.countByStatus("SKU-1", SerializedItemStatus.InStock);

    expect(count).toBe(5);
    expect(sharedPrisma.serializedItemModel.count).toHaveBeenCalledWith(expect.objectContaining({
      where: { sku: "SKU-1", status: SerializedItemStatus.InStock }
    }));
  });

  it("should save a serialized item and dispatch events", async () => {
    const serial = new SerialNumber("SN-123");
    const item = new SerializedItem("item-1", "SKU-1", serial, "t-1", "loc-1", SerializedItemStatus.Pending);
    item.receive("loc-1", "actor-1", "ref-1"); // transitions to InStock

    await repo.save(item);

    expect(sharedPrisma.$transaction).toHaveBeenCalled();
    expect(DomainEventDispatcher.dispatch).toHaveBeenCalled();
  });

  it("should save many serialized items and dispatch events", async () => {
    const item1 = new SerializedItem("item-1", "SKU-1", new SerialNumber("SN-1"), "t-1", "loc-1", SerializedItemStatus.Pending);
    const item2 = new SerializedItem("item-2", "SKU-2", new SerialNumber("SN-2"), "t-1", "loc-1", SerializedItemStatus.Pending);

    item1.receive("loc-1", "actor-1", "ref-1");

    await repo.saveMany([item1, item2]);

    expect(sharedPrisma.$transaction).toHaveBeenCalled();
    expect(DomainEventDispatcher.dispatch).toHaveBeenCalledTimes(2);
  });
});
