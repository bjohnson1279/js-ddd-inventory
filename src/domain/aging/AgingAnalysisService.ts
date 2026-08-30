export interface AgingBucket {
  bucket: string; // '0-30d', '31-60d', '61-90d', '91-180d', '180d+'
  sku: string;
  quantity: number;
  value: number; // in cents
}

export interface AgingReport {
  generatedAt: Date;
  buckets: AgingBucket[];
}

export class AgingAnalysisService {
  /**
   * Generates an aging report from inventory cost layers.
   * Assumes layers have a receivedAt date.
   */
  public generateAgingReport(layers: any[], now: Date = new Date()): AgingReport {
    const buckets: Record<string, AgingBucket> = {};
    
    // Helper to get bucket key based on days diff
    const getBucket = (days: number): string => {
      if (days <= 30) return '0-30d';
      if (days <= 60) return '31-60d';
      if (days <= 90) return '61-90d';
      if (days <= 180) return '91-180d';
      return '180d+';
    };

    for (const layer of layers) {
      if (layer.remainingQuantity <= 0) continue;

      const diffTime = Math.abs(now.getTime() - new Date(layer.receivedAt).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const bucketKey = getBucket(diffDays);
      const sku = layer.sku || layer.variantId; // depends on how data is joined
      const key = `${sku}_${bucketKey}`;

      if (!buckets[key]) {
        buckets[key] = {
          bucket: bucketKey,
          sku,
          quantity: 0,
          value: 0
        };
      }

      buckets[key].quantity += layer.remainingQuantity;
      buckets[key].value += (layer.remainingQuantity * layer.unitCostCents);
    }

    return {
      generatedAt: now,
      buckets: Object.values(buckets)
    };
  }
}
