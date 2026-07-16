import { IDispatchRecordRepository } from "../../repositories/IDispatchRecordRepository";
import { IProductRepository } from "../../repositories/IProductRepository";
import { IPurchaseOrderRepository } from "../../repositories/IPurchaseOrderRepository";
import { SKU } from "../../valueObjects/SKU";
import { PurchaseOrderStatus } from "../enums/PurchaseOrderStatus";

export class DemandVelocityCalculator {
  constructor(
    private readonly dispatchRecordRepository: IDispatchRecordRepository,
    private readonly productRepository: IProductRepository
  ) {}

  async calculateDailySalesStats(
    skuStr: string,
    locationId: string,
    windowDays: number = 30
  ): Promise<{ average: number; stdDev: number }> {
    const sku = SKU.create(skuStr);
    const product = await this.productRepository.findBySku(sku);
    if (!product) {
      return { average: 0, stdDev: 0 };
    }

    const now = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - windowDays);
    const startDateClean = new Date(startDate);
    startDateClean.setHours(0, 0, 0, 0);

    const history = await this.dispatchRecordRepository.fetchHistory(skuStr, locationId, startDateClean);
    const totalQuantity = history.reduce((sum, r) => sum + r.quantity, 0);
    const average = totalQuantity / windowDays;

    const dailyQuantities = new Array(windowDays).fill(0);
    const msInDay = 24 * 60 * 60 * 1000;
    const todayClean = new Date();
    todayClean.setHours(23, 59, 59, 999);

    for (const record of history) {
      const diffMs = todayClean.getTime() - record.dispatchedAt.getTime();
      const dayOffset = Math.floor(diffMs / msInDay);
      const dayIndex = windowDays - 1 - dayOffset;
      if (dayIndex >= 0 && dayIndex < windowDays) {
        dailyQuantities[dayIndex] += record.quantity;
      }
    }

    const varianceSum = dailyQuantities.reduce((sum, qty) => sum + Math.pow(qty - average, 2), 0);
    const stdDev = Math.sqrt(varianceSum / windowDays);

    return { average, stdDev };
  }
}

export class ReorderPointForecaster {
  constructor(
    private readonly velocityCalculator: DemandVelocityCalculator,
    private readonly productRepository: IProductRepository,
    private readonly poRepository: IPurchaseOrderRepository
  ) {}

  async forecastReorderPoint(
    skuStr: string,
    locationId: string,
    leadTimeDays: number,
    safetyStock: number,
    windowDays: number,
    tenantId?: string
  ): Promise<number> {
    const { average: meanSales, stdDev: stdDevSales } =
      await this.velocityCalculator.calculateDailySalesStats(skuStr, locationId, windowDays);

    let leadTimeDaysAvg = leadTimeDays;
    let leadTimeDaysStdDev = 0;

    if (tenantId) {
      const sku = SKU.create(skuStr);
      const product = await this.productRepository.findBySku(sku);
      if (product) {
        const variant = product.variants.find((v) => v.sku.getValue() === skuStr);
        if (variant) {
          const allPos = (await this.poRepository.findAll()).filter((po) => po.tenantId === tenantId);
          const getLocIdStr = (loc: any) => typeof loc === 'string' ? loc : (loc && typeof loc.value === 'string' ? loc.value : '');
          const ruleLocIdStr = getLocIdStr(locationId);
          const ruleVarId = variant.id;

          // Filter received POs containing this variant at this location
          let receivedPos = allPos.filter((po) =>
            po.status === PurchaseOrderStatus.Received &&
            getLocIdStr(po.locationId) === ruleLocIdStr &&
            po.items.some((item) => item.variantId === ruleVarId)
          );

          // Fallback: search across all locations for this tenant if none at destination location
          if (receivedPos.length === 0) {
            receivedPos = allPos.filter((po) =>
              po.status === PurchaseOrderStatus.Received &&
              po.items.some((item) => item.variantId === ruleVarId)
            );
          }

          if (receivedPos.length > 0) {
            const leadTimes = receivedPos.map((po) => {
              if (po.createdAt && po.updatedAt) {
                const diffMs = po.updatedAt.getTime() - po.createdAt.getTime();
                return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
              }
              return leadTimeDays;
            });

            const totalLT = leadTimes.reduce((sum, lt) => sum + lt, 0);
            leadTimeDaysAvg = totalLT / leadTimes.length;

            const ltVarianceSum = leadTimes.reduce((sum, lt) => sum + Math.pow(lt - leadTimeDaysAvg, 2), 0);
            leadTimeDaysStdDev = Math.sqrt(ltVarianceSum / leadTimes.length);
          }
        }
      }
    }

    const zScore = 1.65; // 95% service level
    const term1 = leadTimeDaysAvg * Math.pow(stdDevSales, 2);
    const term2 = Math.pow(meanSales, 2) * Math.pow(leadTimeDaysStdDev, 2);
    const calculatedSafetyStock = zScore * Math.sqrt(term1 + term2);

    const finalSafetyStock = calculatedSafetyStock > 0 ? calculatedSafetyStock : safetyStock;
    const rawRop = meanSales * leadTimeDaysAvg + finalSafetyStock;

    return Math.ceil(rawRop);
  }
}
