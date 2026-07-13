import { IDispatchRecordRepository } from "../../domain/repositories/IDispatchRecordRepository";
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { SKU } from "../../domain/valueObjects/SKU";

export interface SalesVelocityResult {
  sku: string;
  locationId: string;
  currentStock: number;
  averageDailySales7d: number;
  averageDailySales30d: number;
  averageDailySales90d: number;
  daysOfCover: number; // Infinity if sales are 0
  runOutDate: Date | null;
}

export class CalculateSalesVelocity {
  constructor(
    private readonly dispatchRecordRepository: IDispatchRecordRepository,
    private readonly inventoryRepository: IInventoryRepository
  ) {}

  async execute(skuStr: string, locationId: string = "default"): Promise<SalesVelocityResult> {
    const now = new Date();
    
    // Define dates for intervals
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Fetch history once for the 90-day window to minimize database queries
    const history90d = await this.dispatchRecordRepository.fetchHistory(skuStr, locationId, ninetyDaysAgo);

    // Filter the 90-day history in memory for 30-day and 7-day windows
    const thirtyDaysAgoTime = thirtyDaysAgo.getTime();
    const sevenDaysAgoTime = sevenDaysAgo.getTime();

    const history30d = history90d.filter(r => r.dispatchedAt.getTime() >= thirtyDaysAgoTime);
    const history7d = history30d.filter(r => r.dispatchedAt.getTime() >= sevenDaysAgoTime);

    // Fetch current inventory
    const sku = SKU.create(skuStr);
    const inventoryItem = await this.inventoryRepository.findBySku(sku, locationId);
    const currentStock = inventoryItem ? inventoryItem.quantity.getValue() : 0;

    // Sum quantities
    const sum7d = history7d.reduce((acc, r) => acc + r.quantity, 0);
    const sum30d = history30d.reduce((acc, r) => acc + r.quantity, 0);
    const sum90d = history90d.reduce((acc, r) => acc + r.quantity, 0);

    // Compute ADS (Average Daily Sales)
    const ads7d = parseFloat((sum7d / 7).toFixed(3));
    const ads30d = parseFloat((sum30d / 30).toFixed(3));
    const ads90d = parseFloat((sum90d / 90).toFixed(3));

    // Compute Days of Cover and Run Out Date
    let daysOfCover = Infinity;
    let runOutDate: Date | null = null;

    if (ads30d > 0) {
      daysOfCover = Math.ceil(currentStock / ads30d);
      runOutDate = new Date(now.getTime() + daysOfCover * 24 * 60 * 60 * 1000);
    }

    return {
      sku: skuStr,
      locationId,
      currentStock,
      averageDailySales7d: ads7d,
      averageDailySales30d: ads30d,
      averageDailySales90d: ads90d,
      daysOfCover,
      runOutDate
    };
  }
}
