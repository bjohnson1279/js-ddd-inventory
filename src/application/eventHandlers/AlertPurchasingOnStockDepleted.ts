import { StockDepletedEvent } from "../../domain/events/StockDepletedEvent";

export const alertPurchasingOnStockDepleted = async (event: StockDepletedEvent): Promise<void> => {
  console.info(JSON.stringify({
    message: "[ALERT] Stock depleted. Purchasing department notified.",
    event: event.eventName,
    sku: event.sku,
    aggregateId: event.aggregateId,
    occurredOn: event.occurredOn
  }));
};
