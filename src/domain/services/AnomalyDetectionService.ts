import { prisma } from "../../infrastructure/database/prisma";
import { Logger } from "../../infrastructure/logging/logger";

export class AnomalyDetectionService {
  private readonly sidecarUrl: string;

  constructor() {
    this.sidecarUrl = process.env.PYTHON_SIDECAR_URL || "http://localhost:5005";
  }

  async analyze(tenantId: string): Promise<any> {
    try {
      const audits = await prisma.inventoryAuditModel.findMany({
        where: { tenantId },
        include: { items: true },
        take: 100,
        orderBy: { createdAt: 'desc' }
      });

      const cycle_counts = audits.flatMap(audit => 
        audit.items.filter(item => item.isCounted).map(item => ({
          sku: item.variantId,
          location_id: audit.locationId,
          expected_quantity: item.expectedQuantity,
          counted_quantity: item.countedQuantity || 0,
          counted_at: audit.updatedAt.toISOString(),
          actor_id: "system"
        }))
      );

      const rfidTags = await prisma.rfidTagModel.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' }
      });

      const scan_events = rfidTags.map(tag => ({
        sku: tag.sku,
        location_id: tag.lastLocation || "unknown",
        scan_context: tag.status,
        scanned_at: (tag.lastSeenAt || tag.createdAt).toISOString(),
        actor_id: "system"
      }));

      const ledgers = await prisma.complianceLedgerModel.findMany({
        where: { tenantId },
        take: 100,
        orderBy: { timestamp: 'desc' }
      });

      const ledger_entries: any[] = [];
      for (const l of ledgers) {
        try {
          const payload = JSON.parse(l.payload);
          if (payload.quantity) {
            ledger_entries.push({
              sku: payload.sku || "unknown",
              location_id: payload.locationId || "unknown",
              quantity: payload.quantity,
              reason: payload.reason || l.eventType,
              actor_id: payload.actorId || "system",
              occurred_at: l.timestamp.toISOString(),
              reference_id: l.id
            });
          }
        } catch (e) {}
      }

      const payload = {
        ledger_entries,
        cycle_counts,
        scan_events
      };

      const response = await fetch(`${this.sidecarUrl}/anomaly-detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      Logger.error({ context: "AnomalyDetectionService", message: error.message });
      throw new Error("Failed to detect anomalies");
    }
  }
}
