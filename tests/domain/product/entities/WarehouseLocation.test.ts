import { WarehouseLocation } from "../../../../src/domain/product/entities/WarehouseLocation";
import { LocationId } from "../../../../src/domain/valueObjects/LocationId";

describe("WarehouseLocation Entity", () => {
  describe("Constructor & Validations", () => {
    it("should instantiate successfully with valid parameters", () => {
      const locId = new LocationId("WH1-ZA-A01-R01-S01-B01");
      const loc = new WarehouseLocation(
        locId,
        "WH1",
        "ZA",
        "A01",
        "R01",
        "S01",
        "B01",
        50000,
        2.5,
        10,
        20,
        2,
        3
      );

      expect(loc.id).toBe(locId);
      expect(loc.warehouseId).toBe("WH1");
      expect(loc.zone).toBe("ZA");
      expect(loc.aisle).toBe("A01");
      expect(loc.rack).toBe("R01");
      expect(loc.shelf).toBe("S01");
      expect(loc.bin).toBe("B01");
      expect(loc.maxWeightGrams).toBe(50000);
      expect(loc.maxVolumeCubicMeters).toBe(2.5);
      expect(loc.gridX).toBe(10);
      expect(loc.gridY).toBe(20);
      expect(loc.width).toBe(2);
      expect(loc.height).toBe(3);
      expect(loc.path).toBe("WH1-ZA-A01-R01-S01-B01");
    });

    it("should default gridX, gridY, width, and height if not provided", () => {
      const locId = new LocationId("WH1-ZA-A01-R01-S01-B01");
      const loc = new WarehouseLocation(
        locId,
        "WH1",
        "ZA",
        "A01",
        "R01",
        "S01",
        "B01",
        50000,
        2.5
      );

      expect(loc.gridX).toBe(0);
      expect(loc.gridY).toBe(0);
      expect(loc.width).toBe(1);
      expect(loc.height).toBe(1);
    });

    it("should throw error if warehouseId is empty or whitespace", () => {
      const locId = new LocationId("LOC-1");
      expect(
        () => new WarehouseLocation(locId, "", "ZA", "A01", "R01", "S01", "B01", 100, 1)
      ).toThrow("Warehouse ID cannot be empty.");
      expect(
        () => new WarehouseLocation(locId, "   ", "ZA", "A01", "R01", "S01", "B01", 100, 1)
      ).toThrow("Warehouse ID cannot be empty.");
    });

    it("should throw error if zone is empty or whitespace", () => {
      const locId = new LocationId("LOC-1");
      expect(
        () => new WarehouseLocation(locId, "WH1", "", "A01", "R01", "S01", "B01", 100, 1)
      ).toThrow("Zone cannot be empty.");
      expect(
        () => new WarehouseLocation(locId, "WH1", "   ", "A01", "R01", "S01", "B01", 100, 1)
      ).toThrow("Zone cannot be empty.");
    });

    it("should throw error if aisle is empty or whitespace", () => {
      const locId = new LocationId("LOC-1");
      expect(
        () => new WarehouseLocation(locId, "WH1", "ZA", "", "R01", "S01", "B01", 100, 1)
      ).toThrow("Aisle cannot be empty.");
      expect(
        () => new WarehouseLocation(locId, "WH1", "ZA", "  ", "R01", "S01", "B01", 100, 1)
      ).toThrow("Aisle cannot be empty.");
    });

    it("should throw error if rack is empty or whitespace", () => {
      const locId = new LocationId("LOC-1");
      expect(
        () => new WarehouseLocation(locId, "WH1", "ZA", "A01", "", "S01", "B01", 100, 1)
      ).toThrow("Rack cannot be empty.");
      expect(
        () => new WarehouseLocation(locId, "WH1", "ZA", "A01", "   ", "S01", "B01", 100, 1)
      ).toThrow("Rack cannot be empty.");
    });

    it("should throw error if shelf is empty or whitespace", () => {
      const locId = new LocationId("LOC-1");
      expect(
        () => new WarehouseLocation(locId, "WH1", "ZA", "A01", "R01", "", "B01", 100, 1)
      ).toThrow("Shelf cannot be empty.");
      expect(
        () => new WarehouseLocation(locId, "WH1", "ZA", "A01", "R01", "  ", "B01", 100, 1)
      ).toThrow("Shelf cannot be empty.");
    });

    it("should throw error if bin is empty or whitespace", () => {
      const locId = new LocationId("LOC-1");
      expect(
        () => new WarehouseLocation(locId, "WH1", "ZA", "A01", "R01", "S01", "", 100, 1)
      ).toThrow("Bin cannot be empty.");
      expect(
        () => new WarehouseLocation(locId, "WH1", "ZA", "A01", "R01", "S01", "   ", 100, 1)
      ).toThrow("Bin cannot be empty.");
    });

    it("should throw error if maxWeightGrams is zero or negative", () => {
      const locId = new LocationId("LOC-1");
      expect(
        () => new WarehouseLocation(locId, "WH1", "ZA", "A01", "R01", "S01", "B01", 0, 1)
      ).toThrow("Max weight must be greater than zero.");
      expect(
        () => new WarehouseLocation(locId, "WH1", "ZA", "A01", "R01", "S01", "B01", -5, 1)
      ).toThrow("Max weight must be greater than zero.");
    });

    it("should throw error if maxVolumeCubicMeters is zero or negative", () => {
      const locId = new LocationId("LOC-1");
      expect(
        () => new WarehouseLocation(locId, "WH1", "ZA", "A01", "R01", "S01", "B01", 100, 0)
      ).toThrow("Max volume must be greater than zero.");
      expect(
        () => new WarehouseLocation(locId, "WH1", "ZA", "A01", "R01", "S01", "B01", 100, -2.5)
      ).toThrow("Max volume must be greater than zero.");
    });
  });

  describe("parsePath", () => {
    it("should parse valid path string into WarehouseLocation instance with default capacity", () => {
      const path = "WH1-ZONEA-A03-R02-S01-B10";
      const loc = WarehouseLocation.parsePath(path);

      expect(loc.warehouseId).toBe("WH1");
      expect(loc.zone).toBe("ZONEA");
      expect(loc.aisle).toBe("A03");
      expect(loc.rack).toBe("R02");
      expect(loc.shelf).toBe("S01");
      expect(loc.bin).toBe("B10");
      expect(loc.maxWeightGrams).toBe(1000000);
      expect(loc.maxVolumeCubicMeters).toBe(10);
      expect(loc.path).toBe(path);
      expect(loc.id.value).toBe(path);
    });

    it("should parse valid path string with custom maxWeight and maxVolume", () => {
      const path = "WH2-ZONEB-A01-R05-S02-B01";
      const loc = WarehouseLocation.parsePath(path, 500000, 20);

      expect(loc.warehouseId).toBe("WH2");
      expect(loc.zone).toBe("ZONEB");
      expect(loc.aisle).toBe("A01");
      expect(loc.rack).toBe("R05");
      expect(loc.shelf).toBe("S02");
      expect(loc.bin).toBe("B01");
      expect(loc.maxWeightGrams).toBe(500000);
      expect(loc.maxVolumeCubicMeters).toBe(20);
    });

    it("should throw error if path has fewer than 6 segments", () => {
      expect(() => WarehouseLocation.parsePath("WH1-ZONEA-A03")).toThrow(
        "Invalid location path format. Expected: WH-ZONE-AISLE-RACK-SHELF-BIN"
      );
      expect(() => WarehouseLocation.parsePath("WH1-ZONEA-A03-R02-S01")).toThrow(
        "Invalid location path format. Expected: WH-ZONE-AISLE-RACK-SHELF-BIN"
      );
      expect(() => WarehouseLocation.parsePath("INVALID")).toThrow(
        "Invalid location path format. Expected: WH-ZONE-AISLE-RACK-SHELF-BIN"
      );
    });
  });
});
