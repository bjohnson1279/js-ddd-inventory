import { PrismaDispatchRecordRepository } from "../PrismaDispatchRecordRepository";
import { DispatchRecord } from "../../../domain/repositories/IDispatchRecordRepository";

// Mocking prisma singleton
const mockCreate = jest.fn();
const mockFindMany = jest.fn();

jest.mock("../prisma", () => {
  return {
    prisma: {
      dispatchRecordModel: {
        create: (...args: any) => mockCreate(...args),
        findMany: (...args: any) => mockFindMany(...args)
      }
    }
  };
});

describe("PrismaDispatchRecordRepository", () => {
  let repository: PrismaDispatchRecordRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaDispatchRecordRepository();
  });

  describe("save", () => {
    it("should create a dispatch record in the database", async () => {
      const dispatchTime = new Date("2023-01-01T00:00:00Z");
      const record = new DispatchRecord("id-123", "SKU-001", "LOC-A", 10, dispatchTime, "LOT-999");

      mockCreate.mockResolvedValueOnce({
        id: "id-123",
        sku: "SKU-001",
        locationId: "LOC-A",
        quantity: 10,
        dispatchedAt: dispatchTime,
        lotNumber: "LOT-999"
      });

      await repository.save(record);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          sku: "SKU-001",
          locationId: "LOC-A",
          quantity: 10,
          dispatchedAt: dispatchTime,
          lotNumber: "LOT-999"
        }
      });
    });

    it("should use a transaction client if provided", async () => {
      const dispatchTime = new Date("2023-01-01T00:00:00Z");
      const record = new DispatchRecord("id-123", "SKU-001", "LOC-A", 10, dispatchTime, null);

      const mockTxCreate = jest.fn().mockResolvedValueOnce({});
      const tx = {
        dispatchRecordModel: {
          create: mockTxCreate
        }
      };

      await repository.save(record, tx);

      expect(mockTxCreate).toHaveBeenCalledTimes(1);
      expect(mockTxCreate).toHaveBeenCalledWith({
        data: {
          sku: "SKU-001",
          locationId: "LOC-A",
          quantity: 10,
          dispatchedAt: dispatchTime,
          lotNumber: null
        }
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should save with null lotNumber when lotNumber is undefined", async () => {
      const dispatchTime = new Date("2023-01-01T00:00:00Z");
      const record = new DispatchRecord("id-123", "SKU-001", "LOC-A", 10, dispatchTime);

      mockCreate.mockResolvedValueOnce({});

      await repository.save(record);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          sku: "SKU-001",
          locationId: "LOC-A",
          quantity: 10,
          dispatchedAt: dispatchTime,
          lotNumber: null
        }
      });
    });
  });

  describe("fetchHistory", () => {
    it("should return history records for given sku and location since a given date", async () => {
      const sinceDate = new Date("2023-01-01T00:00:00Z");
      const returnedDate = new Date("2023-01-02T00:00:00Z");

      mockFindMany.mockResolvedValueOnce([
        {
          id: "id-1",
          sku: "SKU-001",
          locationId: "LOC-A",
          quantity: 5,
          dispatchedAt: returnedDate,
          lotNumber: "LOT-001"
        }
      ]);

      const results = await repository.fetchHistory("SKU-001", "LOC-A", sinceDate);

      expect(mockFindMany).toHaveBeenCalledTimes(1);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          sku: "SKU-001",
          locationId: "LOC-A",
          dispatchedAt: {
            gte: sinceDate
          }
        },
        orderBy: { dispatchedAt: "asc" }
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(DispatchRecord);
      expect(results[0].id).toBe("id-1");
      expect(results[0].sku).toBe("SKU-001");
      expect(results[0].locationId).toBe("LOC-A");
      expect(results[0].quantity).toBe(5);
      expect(results[0].dispatchedAt).toBe(returnedDate);
      expect(results[0].lotNumber).toBe("LOT-001");
    });
  });

  describe("fetchByLotNumber", () => {
    it("should return dispatch records associated with a given lot number", async () => {
      const dispatchTime = new Date("2023-01-01T00:00:00Z");

      mockFindMany.mockResolvedValueOnce([
        {
          id: "id-2",
          sku: "SKU-002",
          locationId: "LOC-B",
          quantity: 15,
          dispatchedAt: dispatchTime,
          lotNumber: "LOT-ABC"
        }
      ]);

      const results = await repository.fetchByLotNumber("LOT-ABC");

      expect(mockFindMany).toHaveBeenCalledTimes(1);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          lotNumber: "LOT-ABC"
        },
        orderBy: { dispatchedAt: "desc" }
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(DispatchRecord);
      expect(results[0].id).toBe("id-2");
      expect(results[0].sku).toBe("SKU-002");
      expect(results[0].locationId).toBe("LOC-B");
      expect(results[0].quantity).toBe(15);
      expect(results[0].dispatchedAt).toBe(dispatchTime);
      expect(results[0].lotNumber).toBe("LOT-ABC");
    });
  });
});
