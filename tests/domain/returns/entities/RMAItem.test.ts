import { RMAItem } from "../../../../src/domain/returns/entities/RMAItem";
import { RMAItemStatus } from "../../../../src/domain/returns/enums/RMAItemStatus";
import { RMADisposition } from "../../../../src/domain/returns/enums/RMADisposition";

describe("RMAItem Entity", () => {
  describe("Constructor and Invariant Validations", () => {
    it("should instantiate successfully with default parameters", () => {
      const item = new RMAItem("item-1", "VAR-123", 5, 2500);

      expect(item.id).toBe("item-1");
      expect(item.variantId).toBe("VAR-123");
      expect(item.quantity).toBe(5);
      expect(item.unitCostCents).toBe(2500);
      expect(item.receivedQuantity).toBe(0);
      expect(item.status).toBe(RMAItemStatus.Pending);
      expect(item.disposition).toBeNull();
    });

    it("should instantiate with custom optional parameters", () => {
      const item = new RMAItem(
        "item-2",
        "VAR-456",
        10,
        5000,
        3,
        RMAItemStatus.Pending,
        RMADisposition.Restock
      );

      expect(item.id).toBe("item-2");
      expect(item.variantId).toBe("VAR-456");
      expect(item.quantity).toBe(10);
      expect(item.unitCostCents).toBe(5000);
      expect(item.receivedQuantity).toBe(3);
      expect(item.status).toBe(RMAItemStatus.Pending);
      expect(item.disposition).toBe(RMADisposition.Restock);
    });

    it("should throw an error when quantity is zero", () => {
      expect(() => new RMAItem("item-1", "VAR-1", 0, 100)).toThrow(
        "Quantity must be greater than zero."
      );
    });

    it("should throw an error when quantity is negative", () => {
      expect(() => new RMAItem("item-1", "VAR-1", -5, 100)).toThrow(
        "Quantity must be greater than zero."
      );
    });

    it("should throw an error when unitCostCents is negative", () => {
      expect(() => new RMAItem("item-1", "VAR-1", 5, -1)).toThrow(
        "Unit cost cannot be negative."
      );
    });

    it("should allow zero unitCostCents (free or promotional item)", () => {
      const item = new RMAItem("item-1", "VAR-1", 5, 0);
      expect(item.unitCostCents).toBe(0);
    });

    it("should throw an error when receivedQuantity is negative", () => {
      expect(() => new RMAItem("item-1", "VAR-1", 5, 100, -1)).toThrow(
        "Received quantity cannot be negative."
      );
    });
  });

  describe("receive", () => {
    it("should throw an error when receive amount is zero", () => {
      const item = new RMAItem("item-1", "VAR-1", 5, 1000);
      expect(() => item.receive(0, RMADisposition.Restock)).toThrow(
        "Receive quantity must be greater than zero."
      );
    });

    it("should throw an error when receive amount is negative", () => {
      const item = new RMAItem("item-1", "VAR-1", 5, 1000);
      expect(() => item.receive(-2, RMADisposition.Restock)).toThrow(
        "Receive quantity must be greater than zero."
      );
    });

    it("should throw an error when receive amount exceeds expected quantity", () => {
      const item = new RMAItem("item-1", "VAR-1", 5, 1000);
      expect(() => item.receive(6, RMADisposition.Restock)).toThrow(
        "Cannot receive 6 units. Total received would exceed expected quantity of 5."
      );
    });

    it("should throw an error when cumulative receive exceeds expected quantity", () => {
      const item = new RMAItem("item-1", "VAR-1", 5, 1000);
      item.receive(3, RMADisposition.Restock);

      expect(() => item.receive(3, RMADisposition.Restock)).toThrow(
        "Cannot receive 3 units. Total received would exceed expected quantity of 5."
      );
    });

    it("should handle partial receive correctly and keep status as Pending", () => {
      const item = new RMAItem("item-1", "VAR-1", 10, 1000);
      item.receive(4, RMADisposition.Quarantine);

      expect(item.receivedQuantity).toBe(4);
      expect(item.disposition).toBe(RMADisposition.Quarantine);
      expect(item.status).toBe(RMAItemStatus.Pending);
      expect(item.isFullyProcessed()).toBe(false);
    });

    it("should transition status to Received when fully received", () => {
      const item = new RMAItem("item-1", "VAR-1", 10, 1000);
      item.receive(6, RMADisposition.Restock);
      item.receive(4, RMADisposition.Restock);

      expect(item.receivedQuantity).toBe(10);
      expect(item.disposition).toBe(RMADisposition.Restock);
      expect(item.status).toBe(RMAItemStatus.Received);
      expect(item.isFullyProcessed()).toBe(true);
    });
  });

  describe("reject", () => {
    it("should transition status to Rejected", () => {
      const item = new RMAItem("item-1", "VAR-1", 5, 1000);
      expect(item.status).toBe(RMAItemStatus.Pending);

      item.reject();
      expect(item.status).toBe(RMAItemStatus.Rejected);
      expect(item.isFullyProcessed()).toBe(true);
    });
  });

  describe("isFullyProcessed", () => {
    it("should return false for pending items with zero received", () => {
      const item = new RMAItem("item-1", "VAR-1", 5, 1000);
      expect(item.isFullyProcessed()).toBe(false);
    });

    it("should return false for partially received items", () => {
      const item = new RMAItem("item-1", "VAR-1", 5, 1000);
      item.receive(2, RMADisposition.Restock);
      expect(item.isFullyProcessed()).toBe(false);
    });

    it("should return true for fully received items", () => {
      const item = new RMAItem("item-1", "VAR-1", 5, 1000);
      item.receive(5, RMADisposition.Scrap);
      expect(item.isFullyProcessed()).toBe(true);
    });

    it("should return true for rejected items", () => {
      const item = new RMAItem("item-1", "VAR-1", 5, 1000);
      item.reject();
      expect(item.isFullyProcessed()).toBe(true);
    });
  });
});
