import { WarehouseLocation } from "../../../../src/domain/product/entities/WarehouseLocation";
import { LocationId } from "../../../../src/domain/valueObjects/LocationId";

describe("WarehouseLocation Entity", () => {
  describe("Constructor & Invariants", () => {
    it("should instantiate successfully with valid arguments and default grid dimensions", () => {
      const locationId = new LocationId("LOC-001");
      const location = new WarehouseLocation(
        locationId,
        "WH-MAIN",
        "ZONE-A",
        "A01",
        "R01",
        "S01",
        "B01",
        50000,
        2.5
      );

      expect(location.id).toBe(locationId);
      expect(location.warehouseId).toBe("WH-MAIN");
      expect(location.zone).toBe("ZONE-A");
      expect(location.aisle).toBe("A01");
      expect(location.rack).toBe("R01");
      expect(location.shelf).toBe("S01");
      expect(location.bin).toBe("B01");
      expect(location.maxWeightGrams).toBe(50000);
      expect(location.maxVolumeCubicMeters).toBe(2.5);
      expect(location.gridX).toBe(0);
      expect(location.gridY).toBe(0);
      expect(location.width).toBe(1);
      expect(location.height).toBe(1);
      expect(location.path).toBe("LOC-001");
    });

    it("should instantiate with custom grid coordinates and dimensions", () => {
      const locationId = new LocationId("LOC-002");
      const location = new WarehouseLocation(
        locationId,
        "WH-NORTH",
        "ZONE-B",
        "A02",
        "R03",
        "S02",
        "B05",
        25000,
        1.2,
        10,
        20,
        3,
        4
      );

      expect(location.gridX).toBe(10);
      expect(location.gridY).toBe(20);
      expect(location.width).toBe(3);
      expect(location.height).toBe(4);
    });

    it("should throw an error when warehouseId is empty or whitespace", () => {
      const id = new LocationId("LOC-ERR");
      expect(() => new WarehouseLocation(id, "", "ZONE", "A", "R", "S", "B", 100, 10)).toThrow(
        "Warehouse ID cannot be empty."
      );
      expect(() => new WarehouseLocation(id, "   ", "ZONE", "A", "R", "S", "B", 100, 10)).toThrow(
        "Warehouse ID cannot be empty."
      );
    });

    it("should throw an error when zone is empty or whitespace", () => {
      const id = new LocationId("LOC-ERR");
      expect(() => new WarehouseLocation(id, "WH", "", "A", "R", "S", "B", 100, 10)).toThrow(
        "Zone cannot be empty."
      );
      expect(() => new WarehouseLocation(id, "WH", "   ", "A", "R", "S", "B", 100, 10)).toThrow(
        "Zone cannot be empty."
      );
    });

    it("should throw an error when aisle is empty or whitespace", () => {
      const id = new LocationId("LOC-ERR");
      expect(() => new WarehouseLocation(id, "WH", "ZONE", "", "R", "S", "B", 100, 10)).toThrow(
        "Aisle cannot be empty."
      );
      expect(() => new WarehouseLocation(id, "WH", "ZONE", "   ", "R", "S", "B", 100, 10)).toThrow(
        "Aisle cannot be empty."
      );
    });

    it("should throw an error when rack is empty or whitespace", () => {
      const id = new LocationId("LOC-ERR");
      expect(() => new WarehouseLocation(id, "WH", "ZONE", "A", "", "S", "B", 100, 10)).toThrow(
        "Rack cannot be empty."
      );
      expect(() => new WarehouseLocation(id, "WH", "ZONE", "A", "   ", "S", "B", 100, 10)).toThrow(
        "Rack cannot be empty."
      );
    });

    it("should throw an error when shelf is empty or whitespace", () => {
      const id = new LocationId("LOC-ERR");
      expect(() => new WarehouseLocation(id, "WH", "ZONE", "A", "R", "", "B", 100, 10)).toThrow(
        "Shelf cannot be empty."
      );
      expect(() => new WarehouseLocation(id, "WH", "ZONE", "A", "R", "   ", "B", 100, 10)).toThrow(
        "Shelf cannot be empty."
      );
    });

    it("should throw an error when bin is empty or whitespace", () => {
      const id = new LocationId("LOC-ERR");
      expect(() => new WarehouseLocation(id, "WH", "ZONE", "A", "R", "S", "", 100, 10)).toThrow(
        "Bin cannot be empty."
      );
      expect(() => new WarehouseLocation(id, "WH", "ZONE", "A", "R", "S", "   ", 100, 10)).toThrow(
        "Bin cannot be empty."
      );
    });

    it("should throw an error when maxWeightGrams is zero or negative", () => {
      const id = new LocationId("LOC-ERR");
      expect(() => new WarehouseLocation(id, "WH", "ZONE", "A", "R", "S", "B", 0, 10)).toThrow(
        "Max weight must be greater than zero."
      );
      expect(() => new WarehouseLocation(id, "WH", "ZONE", "A", "R", "S", "B", -50, 10)).toThrow(
        "Max weight must be greater than zero."
      );
    });

    it("should throw an error when maxVolumeCubicMeters is zero or negative", () => {
      const id = new LocationId("LOC-ERR");
      expect(() => new WarehouseLocation(id, "WH", "ZONE", "A", "R", "S", "B", 1000, 0)).toThrow(
        "Max volume must be greater than zero."
      );
      expect(() => new WarehouseLocation(id, "WH", "ZONE", "A", "R", "S", "B", 1000, -1)).toThrow(
        "Max volume must be greater than zero."
      );
    });
  });

  describe("parsePath", () => {
    it("should parse a valid 6-part path with default weight and volume", () => {
      const path = "WH1-ZONEA-A03-R02-S01-B10";
      const location = WarehouseLocation.parsePath(path);

      expect(location.path).toBe(path);
      expect(location.warehouseId).toBe("WH1");
      expect(location.zone).toBe("ZONEA");
      expect(location.aisle).toBe("A03");
      expect(location.rack).toBe("R02");
      expect(location.shelf).toBe("S01");
      expect(location.bin).toBe("B10");
      expect(location.maxWeightGrams).toBe(1000000);
      expect(location.maxVolumeCubicMeters).toBe(10);
      expect(location.id.value).toBe(path);
    });

    it("should parse a valid path with custom weight and volume", () => {
      const path = "WH2-COLD-A01-R01-S01-B01";
      const location = WarehouseLocation.parsePath(path, 50000, 3.5);

      expect(location.maxWeightGrams).toBe(50000);
      expect(location.maxVolumeCubicMeters).toBe(3.5);
    });

    it("should throw an error when path has fewer than 6 segments", () => {
      expect(() => WarehouseLocation.parsePath("WH1-ZONEA-A03-R02-S01")).toThrow(
        "Invalid location path format. Expected: WH-ZONE-AISLE-RACK-SHELF-BIN"
      );
      expect(() => WarehouseLocation.parsePath("WH1-ZONEA")).toThrow(
        "Invalid location path format. Expected: WH-ZONE-AISLE-RACK-SHELF-BIN"
      );
      expect(() => WarehouseLocation.parsePath("")).toThrow(
        "Invalid location path format. Expected: WH-ZONE-AISLE-RACK-SHELF-BIN"
      );
    });
  });
});
