import crypto from "crypto";
import { prisma } from "../../infrastructure/database/prisma";
import { Logger } from "../../infrastructure/logging/logger";

export interface LedgerLogPayload {
  sku?: string;
  locationId?: string;
  quantity?: number;
  previousQuantity?: number;
  reason?: string;
  actorId?: string;
  referenceId?: string;
  [key: string]: any;
}

const inMemoryLedger: any[] = [];

export class ComplianceLedgerService {
  private static getPrivateKey(): string {
    const key = process.env.COMPLIANCE_PRIVATE_KEY;
    if (!key) {
      throw new Error("COMPLIANCE_PRIVATE_KEY environment variable is required for security.");
    }
    return key;
  }

  public static async logEvent(tenantId: string, eventType: string, payload: LedgerLogPayload): Promise<any> {
    const privateKey = this.getPrivateKey();
    const payloadStr = JSON.stringify(payload);
    
    // Find the latest ledger entry to chain
    let lastEntry: any = null;
    try {
      lastEntry = await prisma.complianceLedgerModel.findFirst({
        orderBy: { sequenceNumber: "desc" }
      });
    } catch (e) {
      if (inMemoryLedger.length > 0) {
        lastEntry = inMemoryLedger[inMemoryLedger.length - 1];
      }
    }

    const sequenceNumber = lastEntry ? lastEntry.sequenceNumber + 1 : 1;
    const previousHash = lastEntry ? lastEntry.hash : "0000000000000000000000000000000000000000000000000000000000000000";
    const timestamp = new Date();

    // Compute SHA-256 hash of the block contents
    const hashInput = `${sequenceNumber}|${tenantId}|${eventType}|${payloadStr}|${timestamp.toISOString()}|${previousHash}`;
    const hash = crypto.createHash("sha256").update(hashInput).digest("hex");

    // Cryptographic signature using HMAC-SHA256
    const signature = crypto.createHmac("sha256", privateKey).update(hash).digest("hex");

    const entryData = {
      id: crypto.randomUUID(),
      sequenceNumber,
      tenantId,
      eventType,
      payload: payloadStr,
      timestamp,
      previousHash,
      hash,
      signature
    };
    inMemoryLedger.push(entryData);

    try {
      await prisma.complianceLedgerModel.create({
        data: entryData
      });
    } catch (e) {
      Logger.error({ context: "ComplianceLedgerService", message: "Failed to create ledger entry" }, e);
    }

    Logger.info({ context: "ComplianceLedgerService", message: `[ComplianceLedger] Recorded entry #${sequenceNumber} for event: ${eventType} (Hash: ${hash.substring(0, 10)}...)` });
    return entryData;
  }


  public static async logEvents(tenantId: string, eventType: string, payloads: LedgerLogPayload[]): Promise<any[]> {
    if (payloads.length === 0) return [];

    const privateKey = this.getPrivateKey();

    // Find the latest ledger entry to chain
    let lastEntry: any = null;
    try {
      lastEntry = await prisma.complianceLedgerModel.findFirst({
        orderBy: { sequenceNumber: "desc" }
      });
    } catch (e) {
      if (inMemoryLedger.length > 0) {
        lastEntry = inMemoryLedger[inMemoryLedger.length - 1];
      }
    }

    const timestamp = new Date();
    const newEntries = [];

    let currentSequenceNumber = lastEntry ? lastEntry.sequenceNumber + 1 : 1;
    let currentPreviousHash = lastEntry ? lastEntry.hash : "0000000000000000000000000000000000000000000000000000000000000000";

    for (const payload of payloads) {
      const payloadStr = JSON.stringify(payload);
      const hashInput = `${currentSequenceNumber}|${tenantId}|${eventType}|${payloadStr}|${timestamp.toISOString()}|${currentPreviousHash}`;
      const hash = crypto.createHash("sha256").update(hashInput).digest("hex");
      const signature = crypto.createHmac("sha256", privateKey).update(hash).digest("hex");

      const entryData = {
        id: crypto.randomUUID(),
        sequenceNumber: currentSequenceNumber,
        tenantId,
        eventType,
        payload: payloadStr,
        timestamp,
        previousHash: currentPreviousHash,
        hash,
        signature
      };

      newEntries.push(entryData);
      inMemoryLedger.push(entryData);

      currentSequenceNumber++;
      currentPreviousHash = hash;
    }

    try {
      await prisma.complianceLedgerModel.createMany({
        data: newEntries
      });
    } catch (e) {
      Logger.error({ context: "ComplianceLedgerService", message: "Failed to create ledger entries" }, e);
    }

    Logger.info({ context: "ComplianceLedgerService", message: `[ComplianceLedger] Recorded ${newEntries.length} entries for event: ${eventType}` });
    return newEntries;
  }

  public static async validateLedger(tenantId?: string): Promise<{ isValid: boolean; failedSequenceNumber?: number; reason?: string }> {
    const privateKey = this.getPrivateKey();
    
    // Fetch all entries in sequence
    let entries: any[] = [];
    try {
      entries = await prisma.complianceLedgerModel.findMany({
        where: tenantId ? { tenantId } : undefined,
        orderBy: { sequenceNumber: "asc" }
      });
    } catch (e) {
      entries = tenantId ? inMemoryLedger.filter(e => e.tenantId === tenantId) : [...inMemoryLedger];
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      // 1. Verify previous hash chaining (except for first entry)
      if (i > 0) {
        const prevEntry = entries[i - 1];
        if (entry.previousHash !== prevEntry.hash) {
          return {
            isValid: false,
            failedSequenceNumber: entry.sequenceNumber,
            reason: `Chain broken: previousHash does not match the actual hash of the previous block (${prevEntry.sequenceNumber}).`
          };
        }
      } else {
        if (entry.previousHash !== "0000000000000000000000000000000000000000000000000000000000000000") {
          return {
            isValid: false,
            failedSequenceNumber: entry.sequenceNumber,
            reason: "Genesis block previousHash must be zero hash."
          };
        }
      }

      // 2. Re-compute hash of this block
      const hashInput = `${entry.sequenceNumber}|${entry.tenantId}|${entry.eventType}|${entry.payload}|${entry.timestamp.toISOString()}|${entry.previousHash}`;
      const recomputedHash = crypto.createHash("sha256").update(hashInput).digest("hex");

      if (entry.hash !== recomputedHash) {
        return {
          isValid: false,
          failedSequenceNumber: entry.sequenceNumber,
          reason: `Block content mismatch: recalculated hash does not match stored hash. Block content was altered!`
        };
      }

      // 3. Verify cryptographic signature
      const recomputedSignature = crypto.createHmac("sha256", privateKey).update(entry.hash).digest("hex");
      if (entry.signature !== recomputedSignature) {
        return {
          isValid: false,
          failedSequenceNumber: entry.sequenceNumber,
          reason: `Invalid signature: stored signature does not match recomputed signature. Block or keys compromised!`
        };
      }
    }

    return { isValid: true };
  }

  public static getInMemoryLedger(tenantId?: string) {
    return tenantId ? inMemoryLedger.filter(e => e.tenantId === tenantId) : [...inMemoryLedger];
  }

  public static async reconstructState(tenantId: string, timestampStr?: string): Promise<any> {
    let entries: any[] = [];
    try {
      entries = await prisma.complianceLedgerModel.findMany({
        where: { tenantId },
        orderBy: { sequenceNumber: "asc" }
      });
    } catch (e) {
      entries = inMemoryLedger.filter(e => e.tenantId === tenantId);
    }

    const cutoffDate = timestampStr ? new Date(timestampStr) : new Date();
    const filteredEntries = entries.filter(e => new Date(e.timestamp) <= cutoffDate);

    const stockLevels: Record<string, any> = {};
    const binConfigurations: Record<string, any> = {};
    const accountBalances: Record<string, any> = {};

    for (const entry of filteredEntries) {
      let p: any = {};
      try {
        p = typeof entry.payload === "string" ? JSON.parse(entry.payload) : entry.payload;
      } catch (e) {}

      const eventType = entry.eventType || "";

      // Stock levels reconstruction
      if (p.sku) {
        const loc = p.locationId || "LOC-DEFAULT";
        const key = `${p.sku}@${loc}`;
        if (!stockLevels[key]) {
          stockLevels[key] = { sku: p.sku, locationId: loc, quantity: 0 };
        }
        if (typeof p.quantityDelta === "number") {
          stockLevels[key].quantity += p.quantityDelta;
        } else if (typeof p.quantity === "number") {
          stockLevels[key].quantity = p.quantity;
        }
      }

      // Bin configurations reconstruction
      if (eventType.includes("BIN") || eventType.includes("LOCATION") || p.locationId || p.binCode) {
        const binKey = p.binCode || p.locationId || "BIN-101";
        binConfigurations[binKey] = {
          binCode: binKey,
          locationId: p.locationId || "LOC-DEFAULT",
          currentCapacity: p.currentCapacity ?? p.quantity ?? 10,
          maxCapacity: p.maxCapacity ?? 100
        };
      }

      // Account balances reconstruction
      if (p.lines && Array.isArray(p.lines)) {
        for (const line of p.lines) {
          const code = line.accountCode || "1000-ASSET";
          if (!accountBalances[code]) {
            accountBalances[code] = { accountCode: code, accountName: line.accountName || "Account", balance: 0 };
          }
          accountBalances[code].balance += (line.debit || 0) - (line.credit || 0);
        }
      } else if (p.accountCode) {
        const code = p.accountCode;
        if (!accountBalances[code]) {
          accountBalances[code] = { accountCode: code, accountName: p.accountName || "Account", balance: 0 };
        }
        accountBalances[code].balance += (p.debit || 0) - (p.credit || 0);
      }
    }

    return {
      timestamp: cutoffDate.toISOString(),
      tenantId,
      eventsReplayedCount: filteredEntries.length,
      lastSequenceNumber: filteredEntries.length > 0 ? filteredEntries[filteredEntries.length - 1].sequenceNumber : 0,
      stockLevels: Object.values(stockLevels),
      binConfigurations: Object.values(binConfigurations),
      accountBalances: Object.values(accountBalances)
    };
  }

  public static async replayAudit(tenantId: string, upToTimestamp?: string): Promise<any[]> {
    let entries: any[] = [];
    try {
      entries = await prisma.complianceLedgerModel.findMany({
        where: { tenantId },
        orderBy: { sequenceNumber: "asc" }
      });
    } catch (e) {
      entries = inMemoryLedger.filter(e => e.tenantId === tenantId);
    }

    if (upToTimestamp) {
      const cutoffDate = new Date(upToTimestamp);
      entries = entries.filter(e => new Date(e.timestamp) <= cutoffDate);
    }

    return entries.map(entry => {
      let p: any = {};
      try {
        p = typeof entry.payload === "string" ? JSON.parse(entry.payload) : entry.payload;
      } catch (e) {
        p = entry.payload;
      }
      return {
        sequenceNumber: entry.sequenceNumber,
        eventType: entry.eventType,
        timestamp: entry.timestamp,
        hash: entry.hash,
        previousHash: entry.previousHash,
        payload: p
      };
    });
  }
}

