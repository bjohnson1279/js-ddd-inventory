import { prisma } from "../../infrastructure/database/prisma";
import { Logger } from "../../infrastructure/logging/logger";

export class RebalanceOptimizationService {
  private readonly sidecarUrl: string;

  constructor() {
    this.sidecarUrl = process.env.PYTHON_SIDECAR_URL || "http://localhost:5005";
  }

  async optimize(tenantId: string): Promise<any> {
    try {
      const warehouses = [
        { id: "WH1", name: "Main Warehouse", region: "East" },
        { id: "WH2", name: "Secondary Warehouse", region: "West" }
      ];

      const inventory = await prisma.inventoryModel.findMany({
        take: 500
      });

      const stock_levels = inventory.map(inv => ({
        sku: inv.sku,
        warehouse_id: inv.locationId.startsWith("WH2") ? "WH2" : "WH1",
        on_hand: inv.quantity,
        allocated: inv.allocated,
        in_transit: inv.inTransit,
        safety_stock: 10
      }));

      const demands = await prisma.demandForecastModel.findMany({
        take: 500,
        orderBy: { createdAt: 'desc' }
      });

      const demand_forecasts = demands.map(d => ({
        sku: d.sku,
        warehouse_id: d.locationId.startsWith("WH2") ? "WH2" : "WH1",
        daily_velocity_7d: d.forecastedQuantity / 30,
        daily_velocity_30d: d.forecastedQuantity / 30,
        daily_velocity_90d: d.forecastedQuantity / 30
      }));

      const lead_times = [
        { source_warehouse_id: "WH1", dest_warehouse_id: "WH2", transit_days: 3 },
        { source_warehouse_id: "WH2", dest_warehouse_id: "WH1", transit_days: 3 }
      ];

      const shipping_costs = [
        { source_warehouse_id: "WH1", dest_warehouse_id: "WH2", cost_per_unit: 1.5 },
        { source_warehouse_id: "WH2", dest_warehouse_id: "WH1", cost_per_unit: 1.5 }
      ];

      const payload = {
        warehouses,
        stock_levels,
        demand_forecasts,
        lead_times,
        shipping_costs,
        constraints: {
          max_transfers_per_run: 20,
          min_transfer_quantity: 5,
          min_days_of_cover_target: 14.0
        }
      };

      const response = await fetch(`${this.sidecarUrl}/rebalance-optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      Logger.error({ context: "RebalanceOptimizationService", message: error.message });
      throw new Error("Failed to optimize rebalancing");
    }
  }
}
