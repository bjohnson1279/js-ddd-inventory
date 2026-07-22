import { StockDepletedEvent } from "../../domain/events/StockDepletedEvent";
import { Logger } from "../../infrastructure/logging/logger";

export const alertPurchasingOnStockDepleted = async (event: StockDepletedEvent): Promise<void> => {
  Logger.warn({
    message: "[ALERT] Stock depleted. Purchasing department notified.",
    event: event.eventName,
    sku: event.sku,
    aggregateId: event.aggregateId,
    occurredOn: event.occurredOn
  });
};
