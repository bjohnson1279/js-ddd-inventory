import { RMA } from "../../../../src/domain/returns/aggregates/RMA";
import { RMAItem } from "../../../../src/domain/returns/entities/RMAItem";
import { RMAStatus } from "../../../../src/domain/returns/enums/RMAStatus";
import { RMADisposition } from "../../../../src/domain/returns/enums/RMADisposition";

describe("RMA", () => {
  describe("receiveItem", () => {
    it("should receive an item and update RMA status", () => {
      // Use 'item-1' as both id and variantId so it logically matches 'itemId' concept
      const item = new RMAItem("item-1", "item-1", 10, 100);

      // Start in Authorized state so we can receive items without calling authorize()
      const rma = new RMA(
        "rma-1",
        "RMA-001",
        "tenant-1",
        "customer-1",
        "location-1",
        RMAStatus.Authorized,
        [item]
      );

      rma.receiveItem("item-1", 10, RMADisposition.Restock);

      expect(item.receivedQuantity).toBe(10);
      expect(rma.status).toBe(RMAStatus.Completed);
    });

    it("should throw an error when receiving an item that is not in the RMA", () => {
      const item = new RMAItem("item-1", "item-1", 10, 100);

      const rma = new RMA(
        "rma-1",
        "RMA-001",
        "tenant-1",
        "customer-1",
        "location-1",
        RMAStatus.Authorized,
        [item]
      );

      expect(() => {
        rma.receiveItem("invalid-item", 10, RMADisposition.Restock);
      }).toThrow();
    });
  });
});
