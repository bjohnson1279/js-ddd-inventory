import { TraceProductRecall } from "../../../src/application/useCases/TraceProductRecall";
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

  it("should successfully trace records for a valid lot number", async () => {
    const lotNumber = "LOT-123";
    const date = new Date("2023-01-01T00:00:00Z");
    const records = [
      new DispatchRecord("record-1", "SKU-1", "LOC-1", 10, date, lotNumber),
      new DispatchRecord("record-2", "SKU-2", "LOC-2", 5, date, lotNumber),
    ];
    mockRepo.fetchByLotNumber.mockResolvedValue(records);

    const result = await useCase.execute(lotNumber);

    expect(mockRepo.fetchByLotNumber).toHaveBeenCalledWith(lotNumber);
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      {
        ledgerEntryId: "record-1",
        locationId: "LOC-1",
        quantity: 10,
        occurredAt: date,
        lotNumber: lotNumber,
      },
      {
        ledgerEntryId: "record-2",
        locationId: "LOC-2",
        quantity: 5,
        occurredAt: date,
        lotNumber: lotNumber,
      },
    ]);
  });

  it("should return an empty array if the lot number does not exist", async () => {
    const lotNumber = "NON-EXISTENT-LOT";
    mockRepo.fetchByLotNumber.mockResolvedValue([]);

    const result = await useCase.execute(lotNumber);

    expect(mockRepo.fetchByLotNumber).toHaveBeenCalledWith(lotNumber);
    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it("should throw an Error if the lot number is an empty string", async () => {
    await expect(useCase.execute("")).rejects.toThrow("Lot number cannot be empty.");
    expect(mockRepo.fetchByLotNumber).not.toHaveBeenCalled();
  });

  it("should throw an Error if the lot number is only whitespace", async () => {
    await expect(useCase.execute("   ")).rejects.toThrow("Lot number cannot be empty.");
    expect(mockRepo.fetchByLotNumber).not.toHaveBeenCalled();
  });

  it("should fallback to the requested lotNumber if record.lotNumber is missing", async () => {
      const lotNumber = "LOT-123";
      const date = new Date("2023-01-01T00:00:00Z");
      // The mock record itself does not have the lotNumber set.
      const records = [
        new DispatchRecord("record-1", "SKU-1", "LOC-1", 10, date, null),
      ];
      mockRepo.fetchByLotNumber.mockResolvedValue(records);

      const result = await useCase.execute(lotNumber);

      expect(mockRepo.fetchByLotNumber).toHaveBeenCalledWith(lotNumber);
      expect(result).toHaveLength(1);
      expect(result[0].lotNumber).toEqual(lotNumber);
  });
});
