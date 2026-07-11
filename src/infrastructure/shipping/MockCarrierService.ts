import * as crypto from "crypto";
import { ICarrierService, CarrierRate, LabelResult } from "../../application/ports/ICarrierService";

export class MockCarrierService implements ICarrierService {
  private getDistance(origin: string, destination: string): number {
    const org = origin.toUpperCase();
    const dest = destination.toLowerCase();
    
    let baseDist = 1000; // default 1000 km
    if (org.includes("EAST") && (dest.includes("ny") || dest.includes("new york") || dest.includes("10001"))) baseDist = 100;
    else if (org.includes("WEST") && (dest.includes("la") || dest.includes("los angeles") || dest.includes("ca") || dest.includes("90210"))) baseDist = 100;
    else if (org.includes("CENTRAL") && (dest.includes("chicago") || dest.includes("il") || dest.includes("60601"))) baseDist = 100;
    else if (org.includes("EAST") && (dest.includes("la") || dest.includes("ca") || dest.includes("90210"))) baseDist = 4000;
    else if (org.includes("WEST") && (dest.includes("ny") || dest.includes("new york") || dest.includes("10001"))) baseDist = 4000;
    
    return baseDist;
  }

  async fetchRates(sku: string, quantity: number, destinationAddress: string, originLocationId?: string): Promise<CarrierRate[]> {
    // Generate simulated rates based on package size, weight estimates, and distance
    const weightFactor = sku.length % 3 + 1; // mock item weight factor
    const baseQuantity = quantity || 1;
    
    const distanceKm = this.getDistance(originLocationId || "default", destinationAddress);
    const distanceCost = Math.ceil(distanceKm * 0.1); // 0.1 cents per km
    
    return [
      {
        carrier: "UPS Ground",
        rateCents: Math.ceil((500 + (weightFactor * 50) + distanceCost) * baseQuantity),
        estimatedDays: distanceKm > 2000 ? 5 : 2
      },
      {
        carrier: "FedEx Express",
        rateCents: Math.ceil((1500 + (weightFactor * 100) + distanceCost * 1.5) * baseQuantity),
        estimatedDays: 1
      },
      {
        carrier: "DHL Worldwide",
        rateCents: Math.ceil((3500 + (weightFactor * 250) + distanceCost * 2) * baseQuantity),
        estimatedDays: distanceKm > 2000 ? 3 : 1
      },
      {
        carrier: "USPS Priority",
        rateCents: Math.ceil((450 + (weightFactor * 35) + distanceCost * 0.8) * baseQuantity),
        estimatedDays: distanceKm > 2000 ? 6 : 3
      }
    ];
  }

  async generateLabel(sku: string, quantity: number, destinationAddress: string, carrier: string, originLocationId?: string): Promise<LabelResult> {
    const rates = await this.fetchRates(sku, quantity, destinationAddress, originLocationId);
    const selectedRate = rates.find(r => r.carrier.toLowerCase() === carrier.toLowerCase()) || rates[0];
    
    const randomSuffix = crypto.randomInt(100000, 1000000);
    let trackingNumber = `TRACK-${randomSuffix}`;
    if (carrier.toLowerCase().includes("ups")) {
      trackingNumber = `1Z999AA1012345${randomSuffix}`;
    } else if (carrier.toLowerCase().includes("fedex")) {
      trackingNumber = `99${randomSuffix}7712`;
    } else if (carrier.toLowerCase().includes("usps")) {
      trackingNumber = `94001118995632${randomSuffix}`;
    }

    const labelUrl = `https://shipping-labels.s3.amazonaws.com/labels/label_${trackingNumber}.pdf`;

    return {
      trackingNumber,
      labelUrl,
      rateCents: selectedRate.rateCents
    };
  }
}
