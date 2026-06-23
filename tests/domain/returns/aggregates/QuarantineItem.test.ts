import { QuarantineItem } from "../../../../src/domain/returns/aggregates/QuarantineItem";
import { QuarantineStatus } from "../../../../src/domain/returns/enums/QuarantineStatus";

describe("QuarantineItem", () => {
  describe("release", () => {
    it("should handle release state transition", () => {
      const item = new QuarantineItem("id", "variant", 1, "reason", "loc", "tenant");
      item.release();
      expect(item.status).toBe(QuarantineStatus.Restocked);
    });

    it("should throw an error if Quarantine item is already resolved", () => {
      const item = new QuarantineItem("id", "variant", 1, "reason", "loc", "tenant");
      item.release();
      expect(() => item.release()).toThrow(Error);
    });
  });

  describe("scrap", () => {
    it("should handle scrap state transition", () => {
      const item = new QuarantineItem("id", "variant", 1, "reason", "loc", "tenant");
      item.scrap();
      expect(item.status).toBe(QuarantineStatus.Scrapped);
    });

    it("should throw an error if Quarantine item is already resolved", () => {
      const item = new QuarantineItem("id", "variant", 1, "reason", "loc", "tenant");
      item.scrap();
      expect(() => item.scrap()).toThrow(Error);
    });
  });
});
