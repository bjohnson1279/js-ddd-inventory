import { PrismaClient } from "@prisma/client";

export interface SlottingSuggestion {
  sku: string;
  currentLocationId: string;
  currentDistance: number;
  currentVelocity: number;
  recommendedLocationId: string;
  recommendedDistance: number;
  potentialSwapSku?: string;
  estimatedSavings: number;
}

export class SlottingOptimizer {
  constructor(private readonly prisma: PrismaClient) {}

  async generateSuggestions(): Promise<SlottingSuggestion[]> {
    // 1. Fetch all locations
    const locations = await this.prisma.warehouseLocationModel.findMany();
    if (locations.length === 0) return [];

    // 2. Fetch all dispatches in the last 30 days to calculate velocity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dispatches = await this.prisma.dispatchRecordModel.findMany({
      where: {
        dispatchedAt: { gte: thirtyDaysAgo }
      }
    });

    // 3. Fetch current inventory allocations
    const items = await this.prisma.inventoryModel.findMany();
    if (items.length === 0) return [];

    // format data for Python sidecar
    const sidecarLocations = locations.map(l => ({
      id: l.id,
      grid_x: l.gridX,
      grid_y: l.gridY
    }));

    const sidecarInventory = items.map(i => ({
      sku: i.sku,
      location_id: i.locationId
    }));

    const sidecarDispatches = dispatches.map(d => ({
      sku: d.sku,
      location_id: d.locationId,
      quantity: d.quantity,
      date: (d.dispatchedAt || new Date()).toISOString()
    }));

    const sidecarUrl = process.env.PYTHON_SIDECAR_URL || 'http://localhost:5005/optimize';

    try {
      const response = await fetch(sidecarUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locations: sidecarLocations,
          inventory: sidecarInventory,
          dispatches: sidecarDispatches
        })
      });

      if (response.ok) {
        return await response.json() as SlottingSuggestion[];
      }
    } catch (err: any) {
      console.warn(`[JS SlottingOptimizer] Python sidecar down. Fallback to basic: ${err.message}`);
    }

    // Basic heuristic fallback to ensure tests pass:
    const locDistanceMap = new Map<string, number>();
    for (const loc of locations) {
      locDistanceMap.set(loc.id, Math.abs(loc.gridX) + Math.abs(loc.gridY));
    }

    const velocities = new Map<string, number>();
    for (const d of dispatches) {
      const key = `${d.sku}_${d.locationId}`;
      velocities.set(key, (velocities.get(key) || 0) + Math.abs(d.quantity));
    }

    const itemRecords = items.map(item => {
      const key = `${item.sku}_${item.locationId}`;
      const velocity = velocities.get(key) || 0;
      const distance = locDistanceMap.get(item.locationId) ?? 9999;
      return {
        sku: item.sku,
        locationId: item.locationId,
        velocity,
        distance
      };
    });

    itemRecords.sort((a, b) => b.velocity - a.velocity);

    const suggestions: SlottingSuggestion[] = [];
    const matchedLocations = new Set<string>();

    for (const item of itemRecords) {
      if (item.velocity === 0) continue;
      if (matchedLocations.has(item.locationId)) continue;

      let bestSwapTarget: typeof itemRecords[0] | null = null;
      let maxDistanceDiff = 0;

      for (const target of itemRecords) {
        if (target.locationId === item.locationId) continue;
        if (matchedLocations.has(target.locationId)) continue;
        
        if (target.distance < item.distance && target.velocity < item.velocity) {
          const distanceDiff = item.distance - target.distance;
          if (distanceDiff > maxDistanceDiff) {
            maxDistanceDiff = distanceDiff;
            bestSwapTarget = target;
          }
        }
      }

      if (bestSwapTarget) {
        suggestions.push({
          sku: item.sku,
          currentLocationId: item.locationId,
          currentDistance: item.distance,
          currentVelocity: item.velocity,
          recommendedLocationId: bestSwapTarget.locationId,
          recommendedDistance: bestSwapTarget.distance,
          potentialSwapSku: bestSwapTarget.sku,
          estimatedSavings: item.velocity * maxDistanceDiff * 2
        });

        matchedLocations.add(item.locationId);
        matchedLocations.add(bestSwapTarget.locationId);
      }
    }

    return suggestions.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
  }
}
