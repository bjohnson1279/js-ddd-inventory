import { RFIDBulkScanIngestionService, RFIDScanRecord } from "../../../src/application/iot/RFIDBulkScanIngestionService";

describe("RFIDBulkScanIngestionService", () => {
  let service: RFIDBulkScanIngestionService;

  beforeEach(() => {
    service = new RFIDBulkScanIngestionService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createRecord = (epc: string): RFIDScanRecord => ({
    epc,
    sku: "TEST-SKU",
    locationId: "LOC-1",
    timestamp: new Date().toISOString()
  });

  it("should process a batch of unique records successfully", () => {
    const records = [createRecord("EPC1"), createRecord("EPC2")];
    const result = service.processBatch(records);

    expect(result.batchSize).toBe(2);
    expect(result.processedCount).toBe(2);
    expect(result.duplicateCount).toBe(0);
    expect(result.timestamp).toBeDefined();
  });

  it("should detect and count duplicates within the same batch", () => {
    const records = [createRecord("EPC1"), createRecord("EPC1")];
    const result = service.processBatch(records);

    expect(result.batchSize).toBe(2);
    expect(result.processedCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });

  it("should detect duplicates across multiple batches within TTL", () => {
    service.processBatch([createRecord("EPC1")]);

    // Process same EPC immediately
    const result = service.processBatch([createRecord("EPC1")]);

    expect(result.batchSize).toBe(1);
    expect(result.processedCount).toBe(0);
    expect(result.duplicateCount).toBe(1);
  });

  it("should not count as duplicate if TTL has expired", () => {
    service.processBatch([createRecord("EPC1")]);

    // Advance time by 60001ms (just past 1 minute DUP_TTL_MS)
    jest.advanceTimersByTime(60001);

    const result = service.processBatch([createRecord("EPC1")]);

    expect(result.batchSize).toBe(1);
    expect(result.processedCount).toBe(1);
    expect(result.duplicateCount).toBe(0);
  });

  it("should cleanup expired cache items", () => {
    service.processBatch([createRecord("EPC1"), createRecord("EPC2")]);

    // Advance time by 30000ms (half TTL)
    jest.advanceTimersByTime(30000);
    service.processBatch([createRecord("EPC3")]); // EPC3 is fresh

    // Advance time by another 30001ms (EPC1 and EPC2 expired, EPC3 still fresh)
    jest.advanceTimersByTime(30001);

    // Process a dummy record to trigger cleanup
    service.processBatch([createRecord("EPC4")]);

    // Internal state verification by processing them again and checking if they are duplicates
    // Since EPC1 is expired and cleaned up, it should be processed as new
    const result1 = service.processBatch([createRecord("EPC1")]);
    expect(result1.processedCount).toBe(1);
    expect(result1.duplicateCount).toBe(0);

    // Since EPC3 was processed 30001ms ago, it's still fresh and should be a duplicate
    const result3 = service.processBatch([createRecord("EPC3")]);
    expect(result3.processedCount).toBe(0);
    expect(result3.duplicateCount).toBe(1);
  });
});
