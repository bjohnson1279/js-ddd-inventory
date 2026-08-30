import { ASN } from './ASN';

export class SupplierOTIFCalculator {
  public calculateOTIF(asns: ASN[]): { onTimeRate: number; otifScore: number } {
    if (asns.length === 0) return { onTimeRate: 100, otifScore: 100 };

    let onTimeCount = 0;
    
    for (const asn of asns) {
      if (asn.actualDelivery && asn.actualDelivery <= asn.expectedDelivery) {
        onTimeCount++;
      }
    }

    const onTimeRate = (onTimeCount / asns.length) * 100;
    // OTIF is usually On Time AND In Full. 
    // Simplified here to just On Time for demonstration if full data is not provided
    const otifScore = onTimeRate; 

    return { onTimeRate, otifScore };
  }
}
