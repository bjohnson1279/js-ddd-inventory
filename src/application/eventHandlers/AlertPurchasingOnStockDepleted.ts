import { StockDepletedEvent } from "../../domain/events/StockDepletedEvent";

export const alertPurchasingOnStockDepleted = async (event: StockDepletedEvent): Promise<void> => {
  console.log(`\n[ALERT - PURCHASING DEPARTMENT]`);
  console.log(`URGENT: Stock for SKU '${event.sku}' has been completely depleted.`);
  console.log(`Event ID (Aggregate): ${event.aggregateId}`);
  console.log(`Time: ${event.occurredOn.toISOString()}`);
  console.log(`Please initiate reorder process.\n`);
};
