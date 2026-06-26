import { alertPurchasingOnStockDepleted } from "../../../src/application/eventHandlers/AlertPurchasingOnStockDepleted";
import { StockDepletedEvent } from "../../../src/domain/events/StockDepletedEvent";

describe("AlertPurchasingOnStockDepleted", () => {
  it("should log the event in a structured format", async () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const event = new StockDepletedEvent("aggregate1", "SKU-123");

    await alertPurchasingOnStockDepleted(event);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[ALERT] Stock depleted. Purchasing department notified."));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("aggregate1"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("SKU-123"));

    consoleSpy.mockRestore();
  });
});
