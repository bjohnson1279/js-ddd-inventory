export interface RFIDScanRecord {
  epc: string;
  sku: string;
  locationId: string;
  timestamp: string;
}

export class RFIDBulkScanIngestionService {
  private recentEPCs: Map<string, number> = new Map();
  private readonly DUP_TTL_MS = 60000; // 1 minute deduplication window

  public processBatch(records: RFIDScanRecord[]) {
    const now = Date.now();
    let processed = 0;
    let duplicates = 0;

    records.forEach((record) => {
      const lastSeen = this.recentEPCs.get(record.epc);
      if (lastSeen && now - lastSeen < this.DUP_TTL_MS) {
        duplicates++;
      } else {
        this.recentEPCs.set(record.epc, now);
        processed++;
      }
    });

    // Cleanup expired cache items
    for (const [epc, timestamp] of this.recentEPCs.entries()) {
      if (now - timestamp > this.DUP_TTL_MS) {
        this.recentEPCs.delete(epc);
      }
    }

    return {
      batchSize: records.length,
      processedCount: processed,
      duplicateCount: duplicates,
      timestamp: new Date().toISOString(),
    };
  }
}
