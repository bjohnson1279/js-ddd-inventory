import { TraceProductRecall, ContaminatedDispatch } from "../../../src/application/useCases/TraceProductRecall";
import { IDispatchRecordRepository, DispatchRecord } from "../../../src/domain/repositories/IDispatchRecordRepository";

describe("TraceProductRecall Use Case", () => {
  let mockRepo: jest.Mocked<IDispatchRecordRepository>;
  let useCase: TraceProductRecall;

  beforeEach(() => {
    mockRepo = {
      save: jest.fn(),
      fetchHistory: jest.fn(),
      fetchByLotNumber: jest.fn(),
    };
    useCase = new TraceProductRecall(mockRepo);
  });

  it("should throw an error when lotNumber is empty", async () => {
    await expect(useCase.execute("")).rejects.toThrow("Lot number cannot be empty.");
    await expect(useCase.execute("   ")).rejects.toThrow("Lot number cannot be empty.");
    expect(mockRepo.fetchByLotNumber).not.toHaveBeenCalled();
  });

  it("should return mapped ContaminatedDispatch array when records are found", async () => {
    const lotNumber = "LOT-123";
    const date = new Date("2023-01-01T10:00:00Z");
    const mockRecords: DispatchRecord[] = [
      new DispatchRecord("entry-1", "SKU-1", "loc-1", 10, date, lotNumber),
      new DispatchRecord("entry-2", "SKU-2", "loc-2", 5, date, lotNumber)
    ];
    mockRepo.fetchByLotNumber.mockResolvedValue(mockRecords);

    const result = await useCase.execute(lotNumber);

    expect(mockRepo.fetchByLotNumber).toHaveBeenCalledWith(lotNumber);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      ledgerEntryId: "entry-1",
      locationId: "loc-1",
      quantity: 10,
      occurredAt: date,
      lotNumber: lotNumber
    });
    expect(result[1]).toEqual({
      ledgerEntryId: "entry-2",
      locationId: "loc-2",
      quantity: 5,
      occurredAt: date,
      lotNumber: lotNumber
    });
  });

  it("should return empty array when no records are found", async () => {
    const lotNumber = "LOT-404";
    mockRepo.fetchByLotNumber.mockResolvedValue([]);

    const result = await useCase.execute(lotNumber);

    expect(mockRepo.fetchByLotNumber).toHaveBeenCalledWith(lotNumber);
    expect(result).toEqual([]);
  });
});
