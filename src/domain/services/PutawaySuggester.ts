import { IInventoryRepository } from "../repositories/IInventoryRepository";
import { IProductRepository } from "../repositories/IProductRepository";
import { IWarehouseLocationRepository } from "../repositories/IWarehouseLocationRepository";
import { ProductVariant } from "../product/entities/ProductVariant";
import { SKU } from "../valueObjects/SKU";

export interface PutawayRecommendation {
  locationId: string;
  quantity: number;
  remainingWeightGrams: number;
  remainingVolumeCubicMeters: number;
}

export class PutawaySuggester {
  constructor(
    private readonly inventoryRepo: IInventoryRepository,
    private readonly productRepo: IProductRepository,
    private readonly locationRepo: IWarehouseLocationRepository
  ) {}

  async suggestPutaway(sku: SKU, quantity: number): Promise<PutawayRecommendation[]> {
    if (quantity <= 0) {
      throw new Error("Quantity to put away must be positive.");
    }

    const product = await this.productRepo.findBySku(sku);
    if (!product) {
      throw new Error(`Product variant with SKU ${sku.getValue()} not found.`);
    }

    const variant = product.variants.find(v => v.sku.equals(sku));
    if (!variant) {
      throw new Error(`Product variant with SKU ${sku.getValue()} not found.`);
    }

    // Load all locations
    const locations = await this.locationRepo.findAll();
    if (locations.length === 0) {
      return [];
    }

    // Batch lookup all inventory items
    const allItems = await this.inventoryRepo.findAll();
    const itemSkusMap = new Map<string, SKU>();
    for (const item of allItems) {
      itemSkusMap.set(item.sku.getValue(), item.sku);
    }

    const itemVariantMap = new Map<string, ProductVariant>();
    if (itemSkusMap.size > 0) {
      const itemProducts = await this.productRepo.findBySkus(Array.from(itemSkusMap.values()));
      for (const ip of itemProducts) {
        for (const iv of ip.variants) {
          itemVariantMap.set(iv.sku.getValue(), iv);
        }
      }
    }

    // Map location items for fast O(1) lookups
    const itemsByLocation = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const locItems = itemsByLocation.get(item.locationId) || [];
      locItems.push(item);
      itemsByLocation.set(item.locationId, locItems);
    }

    // For each location, calculate occupied weight & volume
    const locationCapacities = [];
    for (const loc of locations) {
      const items = itemsByLocation.get(loc.id.value) || [];

      let occupiedWeight = 0;
      let occupiedVolume = 0;

      for (const item of items) {
        const v = itemVariantMap.get(item.sku.getValue());
        if (v) {
          occupiedWeight += item.quantity.getValue() * (v.weightGrams ?? 0);
          occupiedVolume += item.quantity.getValue() * (v.volumeCubicMeters ?? 0);
        }
      }

      const remainingWeight = loc.maxWeightGrams - occupiedWeight;
      const remainingVolume = loc.maxVolumeCubicMeters - occupiedVolume;

      locationCapacities.push({
        location: loc,
        remainingWeight,
        remainingVolume
      });
    }

    // Filter and score candidates based on matching attributes
    const attrs = variant.attributes.all();
    const tempZoneAttr = attrs.find(a => a.name === "temperatureZone")?.value;
    const hazardAttr = attrs.find(a => a.name === "hazardClass")?.value;
    const velocityAttr = attrs.find(a => a.name === "velocity")?.value;

    const scoredCandidates = locationCapacities.map(c => {
      let score = 0;
      let matchesZoneType = true;

      // 1. Temperature Zone: must match if variant specifies it
      if (tempZoneAttr) {
        if (c.location.zone.toLowerCase() === tempZoneAttr.toLowerCase()) {
          score += 100;
        } else {
          matchesZoneType = false;
        }
      }

      // 2. Hazard Class: if hazard class is present (e.g. flammable), prioritize HAZMAT zone.
      // If hazard class is NOT present, do NOT put it in HAZMAT zone.
      if (hazardAttr) {
        if (c.location.zone.toLowerCase() === "hazmat") {
          score += 200;
        } else {
          matchesZoneType = false;
        }
      } else {
        if (c.location.zone.toLowerCase() === "hazmat") {
          matchesZoneType = false; // standard item should not be in HAZMAT
        }
      }

      // 3. Velocity: fast-moving items go to FAST zone or front aisles (e.g., A01, A02)
      if (velocityAttr && velocityAttr.toLowerCase() === "fast-moving") {
        if (c.location.zone.toLowerCase() === "fast") {
          score += 50;
        }
        if (c.location.aisle === "A01" || c.location.aisle === "A02" || c.location.aisle === "A03") {
          score += 30;
        }
      }

      return {
        ...c,
        score,
        matchesZoneType
      };
    });

    // Filter to candidates that have positive remaining capacity and match zone type requirements
    const eligible = scoredCandidates.filter(c =>
      c.matchesZoneType &&
      c.remainingWeight > 0 &&
      c.remainingVolume > 0
    );

    // Sort by score descending, then by remaining weight descending
    eligible.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.remainingWeight - a.remainingWeight;
    });

    // Suggest allocation
    const recommendations: PutawayRecommendation[] = [];
    let remainingToAllocate = quantity;
    const variantWeight = variant.weightGrams ?? 0;
    const variantVolume = variant.volumeCubicMeters ?? 0;

    for (const cand of eligible) {
      if (remainingToAllocate <= 0) {
        break;
      }

      // Calculate how many units we can fit in this candidate location with floating point safety
      const maxUnitsToFit = Math.min(
        variantWeight > 0 ? Math.floor(Number((cand.remainingWeight / variantWeight).toFixed(5))) : Infinity,
        variantVolume > 0 ? Math.floor(Number((cand.remainingVolume / variantVolume).toFixed(5))) : Infinity
      );

      if (maxUnitsToFit <= 0) {
        continue;
      }

      const allocatedQty = Math.min(remainingToAllocate, maxUnitsToFit);

      // Update candidate remaining capacities
      const allocatedWeight = allocatedQty * variantWeight;
      const allocatedVolume = allocatedQty * variantVolume;

      recommendations.push({
        locationId: cand.location.id.value,
        quantity: allocatedQty,
        remainingWeightGrams: cand.remainingWeight - allocatedWeight,
        remainingVolumeCubicMeters: cand.remainingVolume - allocatedVolume
      });

      remainingToAllocate -= allocatedQty;
    }

    if (remainingToAllocate > 0) {
      throw new Error(`Insufficient warehouse capacity to put away the entire quantity of ${quantity} units for SKU ${sku.getValue()}.`);
    }

    return recommendations;
  }
}
