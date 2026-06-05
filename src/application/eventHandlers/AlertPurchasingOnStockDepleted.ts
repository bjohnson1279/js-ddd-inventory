import { StockDepletedEvent } from "../../domain/events/StockDepletedEvent";

export const alertPurchasingOnStockDepleted = async (event: StockDepletedEvent): Promise<void> => {
  // TODO: Integrate with a real notification system (e.g., email, SMS, or Slack)
  // to notify the purchasing department that stock for SKU '${event.sku}' has been depleted.
};
