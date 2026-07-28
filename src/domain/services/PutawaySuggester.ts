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

    const variant = product.findVariantBySku(sku.getValue());
    if (!variant) {
      throw new Error(`Product variant with SKU ${sku.getValue()} not found.`);
    }

    // Load all locations
    const locations = await this.locationRepo.findAll();
    if (locations.length === 0) {
      return [];
    }

    const attrs = variant.attributes.all();
    const tempZoneAttr = attrs.find(a => a.name === "temperatureZone")?.value;
    const hazardAttr = attrs.find(a => a.name === "hazardClass")?.value;
    const velocityAttr = attrs.find(a => a.name === "velocity")?.value;

    // Filter and score candidates based on matching attributes first
    // This avoids fetching inventory for locations we would never use
    const locationCapacities = [];
    const locationItemsCount = new Map<string, number>();

    for (const loc of locations) {
      let score = 0;
      let matchesZoneType = true;

      // 1. Temperature Zone: must match if variant specifies it
      if (tempZoneAttr) {
        if (loc.zone.toLowerCase() === tempZoneAttr.toLowerCase()) {
          score += 100;
        } else {
          matchesZoneType = false;
        }
      }

      // 2. Hazard Class: if hazard class is present (e.g. flammable), prioritize HAZMAT zone.
      // If hazard class is NOT present, do NOT put it in HAZMAT zone.
      if (hazardAttr) {
        if (loc.zone.toLowerCase() === "hazmat") {
          score += 200;
        } else {
          matchesZoneType = false;
        }
      } else {
        if (loc.zone.toLowerCase() === "hazmat") {
          matchesZoneType = false; // standard item should not be in HAZMAT
        }
      }

      // If we don't match the zone type or capacity is exactly 0 before even calculating inventory, skip
      if (!matchesZoneType || loc.maxWeightGrams <= 0 || loc.maxVolumeCubicMeters <= 0) {
        continue;
      }

      // 3. Velocity: fast-moving items go to FAST zone or front aisles (e.g., A01, A02)
      if (velocityAttr && velocityAttr.toLowerCase() === "fast-moving") {
        if (loc.zone.toLowerCase() === "fast") {
          score += 50;
        }
        if (loc.aisle === "A01" || loc.aisle === "A02" || loc.aisle === "A03") {
          score += 30;
        }
      }

      locationCapacities.push({
        location: loc,
        remainingWeight: loc.maxWeightGrams,
        remainingVolume: loc.maxVolumeCubicMeters,
        score,
        matchesZoneType
      });
      locationItemsCount.set(loc.id.value, locationCapacities.length - 1);
    }

    if (locationCapacities.length === 0) {
      return [];
    }

    // Batch lookup inventory items only for eligible locations
    let allItems: any[] = [];

    if (this.inventoryRepo.findAllByLocationIds) {
      const locationIds = Array.from(locationItemsCount.keys());
      // Chunk to avoid query param limits (e.g., PostgreSQL 65535 limit)
      const chunkSize = 500;
      for (let i = 0; i < locationIds.length; i += chunkSize) {
        const chunk = locationIds.slice(i, i + chunkSize);
        const itemsChunk = await this.inventoryRepo.findAllByLocationIds(chunk);
        allItems = allItems.concat(itemsChunk);
      }
    } else {
      const fullItems = await this.inventoryRepo.findAll();
      // Only keep items that belong to our filtered locations
      allItems = fullItems.filter(item => locationItemsCount.has(item.locationId));
    }

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

    for (const item of allItems) {
      const idx = locationItemsCount.get(item.locationId);
      if (idx !== undefined) {
        const v = itemVariantMap.get(item.sku.getValue());
        if (v) {
          locationCapacities[idx].remainingWeight -= item.quantity.getValue() * (v.weightGrams ?? 0);
          locationCapacities[idx].remainingVolume -= item.quantity.getValue() * (v.volumeCubicMeters ?? 0);
        }
      }
    }

    // Filter to candidates that have positive remaining capacity and match zone type requirements
    const eligible = locationCapacities.filter(c =>
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
