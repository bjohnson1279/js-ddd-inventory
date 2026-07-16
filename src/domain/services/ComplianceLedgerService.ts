import crypto from "crypto";
import { prisma } from "../../infrastructure/database/prisma";

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

export class ComplianceLedgerService {
  private static getPrivateKey(): string {
    return process.env.COMPLIANCE_PRIVATE_KEY || "system-secret-compliance-ledger-key-2026";
  }

  public static async logEvent(tenantId: string, eventType: string, payload: LedgerLogPayload): Promise<any> {
    const privateKey = this.getPrivateKey();
    const payloadStr = JSON.stringify(payload);

    // Find the latest ledger entry to chain
    const lastEntry = await prisma.complianceLedgerModel.findFirst({
      orderBy: { sequenceNumber: "desc" }
    });

    const sequenceNumber = lastEntry ? lastEntry.sequenceNumber + 1 : 1;
    const previousHash = lastEntry ? lastEntry.hash : "0000000000000000000000000000000000000000000000000000000000000000";
    const timestamp = new Date();

    // Compute SHA-256 hash of the block contents
    const hashInput = `${sequenceNumber}|${tenantId}|${eventType}|${payloadStr}|${timestamp.toISOString()}|${previousHash}`;
    const hash = crypto.createHash("sha256").update(hashInput).digest("hex");

    // Cryptographic signature using HMAC-SHA256
    const signature = crypto.createHmac("sha256", privateKey).update(hash).digest("hex");

    const entry = await prisma.complianceLedgerModel.create({
      data: {
        sequenceNumber,
        tenantId,
        eventType,
        payload: payloadStr,
        timestamp,
        previousHash,
        hash,
        signature
      }
    });

    console.log(`[ComplianceLedger] Recorded entry #${sequenceNumber} for event: ${eventType} (Hash: ${hash.substring(0, 10)}...)`);
    return entry;
  }

  public static async validateLedger(tenantId?: string): Promise<{ isValid: boolean; failedSequenceNumber?: number; reason?: string }> {
    const privateKey = this.getPrivateKey();

    // Fetch all entries in sequence
    const entries = await prisma.complianceLedgerModel.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { sequenceNumber: "asc" }
    });

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
}
