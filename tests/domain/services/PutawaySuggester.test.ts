import { PutawaySuggester } from "../../../src/domain/services/PutawaySuggester";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { Product } from "../../../src/domain/product/aggregates/Product";
import { VariantAttribute } from "../../../src/domain/product/valueObjects/VariantAttribute";
import { WarehouseLocation } from "../../../src/domain/product/entities/WarehouseLocation";
import { LocationId } from "../../../src/domain/valueObjects/LocationId";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";

describe("PutawaySuggester", () => {
  let mockInventoryRepo: any;
  let mockProductRepo: any;
  let mockLocationRepo: any;

  beforeEach(() => {
    mockInventoryRepo = {
      findAll: jest.fn(),
      findAllByLocationIds: jest.fn(),
    };
    mockProductRepo = {
      findBySku: jest.fn(),
      findBySkus: jest.fn(),
    };
    mockLocationRepo = {
      findAll: jest.fn(),
    };
  });

  describe("Invariants & Validation", () => {
    it("should throw an error if quantity is zero or negative", async () => {
      const suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);

      await expect(suggester.suggestPutaway(SKU.create("SKU-1"), 0)).rejects.toThrow(
        "Quantity to put away must be positive."
      );
      await expect(suggester.suggestPutaway(SKU.create("SKU-1"), -5)).rejects.toThrow(
        "Quantity to put away must be positive."
      );
    });

    it("should throw an error if product is not found", async () => {
      mockProductRepo.findBySku.mockResolvedValue(null);
      const suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);

      await expect(suggester.suggestPutaway(SKU.create("NON-EXISTENT"), 5)).rejects.toThrow(
        "Product variant with SKU NON-EXISTENT not found."
      );
    });

    it("should throw an error if product exists but variant does not match SKU", async () => {
      const product = new Product("PROD-1", "Test Product");
      // Add a different SKU variant
      product.addVariant(SKU.create("OTHER-SKU"), [new VariantAttribute("size", "M")], 100, 0.1);
      mockProductRepo.findBySku.mockResolvedValue(product);

      const suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);

      await expect(suggester.suggestPutaway(SKU.create("TARGET-SKU"), 5)).rejects.toThrow(
        "Product variant with SKU TARGET-SKU not found."
      );
    });

    it("should return empty array if no locations exist in warehouse", async () => {
      const product = new Product("PROD-1", "Test Product");
      product.addVariant(SKU.create("TEST-SKU"), [new VariantAttribute("size", "M")], 100, 0.1);
      mockProductRepo.findBySku.mockResolvedValue(product);
      mockLocationRepo.findAll.mockResolvedValue([]);

      const suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);
      const result = await suggester.suggestPutaway(SKU.create("TEST-SKU"), 5);

      expect(result).toEqual([]);
    });
  });

  describe("Zone Filtering & Scoring", () => {
    it("should require matching temperature zone when variant specifies temperatureZone", async () => {
      const product = new Product("PROD-1", "Ice Cream");
      product.addVariant(
        SKU.create("FROZEN-SKU"),
        [new VariantAttribute("temperatureZone", "freezer")],
        200,
        0.05
      );
      mockProductRepo.findBySku.mockResolvedValue(product);

      const ambientLoc = WarehouseLocation.parsePath("WH1-AMBIENT-A01-R01-S01-B01", 10000, 10);
      const freezerLoc = WarehouseLocation.parsePath("WH1-FREEZER-A02-R01-S01-B01", 10000, 10);
      mockLocationRepo.findAll.mockResolvedValue([ambientLoc, freezerLoc]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);
      mockProductRepo.findBySkus.mockResolvedValue([]);

      const suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);
      const suggestions = await suggester.suggestPutaway(SKU.create("FROZEN-SKU"), 5);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].locationId).toBe(freezerLoc.id.value);
    });

    it("should prioritize HAZMAT zone for hazardous items and reject HAZMAT zone for standard items", async () => {
      const hazmatProduct = new Product("PROD-HAZ", "Chemicals");
      hazmatProduct.addVariant(
        SKU.create("HAZ-SKU"),
        [new VariantAttribute("hazardClass", "corrosive")],
        500,
        0.1
      );

      const standardProduct = new Product("PROD-STD", "Book");
      standardProduct.addVariant(SKU.create("STD-SKU"), [new VariantAttribute("type", "hardcover")], 300, 0.05);

      const hazmatLoc = WarehouseLocation.parsePath("WH1-HAZMAT-A01-R01-S01-B01", 20000, 20);
      const generalLoc = WarehouseLocation.parsePath("WH1-GENERAL-A02-R01-S01-B01", 20000, 20);
      mockLocationRepo.findAll.mockResolvedValue([hazmatLoc, generalLoc]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);
      mockProductRepo.findBySkus.mockResolvedValue([]);

      const suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);

      // Hazardous item should only go to HAZMAT location
      mockProductRepo.findBySku.mockResolvedValue(hazmatProduct);
      const hazmatSuggestions = await suggester.suggestPutaway(SKU.create("HAZ-SKU"), 2);
      expect(hazmatSuggestions).toHaveLength(1);
      expect(hazmatSuggestions[0].locationId).toBe(hazmatLoc.id.value);

      // Standard item must NOT be placed in HAZMAT location
      mockProductRepo.findBySku.mockResolvedValue(standardProduct);
      const standardSuggestions = await suggester.suggestPutaway(SKU.create("STD-SKU"), 2);
      expect(standardSuggestions).toHaveLength(1);
      expect(standardSuggestions[0].locationId).toBe(generalLoc.id.value);
    });

    it("should score fast-moving items higher in FAST zones and front aisles", async () => {
      const fastProduct = new Product("PROD-FAST", "Top Seller");
      fastProduct.addVariant(
        SKU.create("FAST-SKU"),
        [new VariantAttribute("velocity", "fast-moving")],
        100,
        0.01
      );
      mockProductRepo.findBySku.mockResolvedValue(fastProduct);

      // Loc1: Normal zone, back aisle (score: 0)
      const locBack = WarehouseLocation.parsePath("WH1-GENERAL-A10-R01-S01-B01", 50000, 10);
      // Loc2: Normal zone, front aisle A01 (score: 30)
      const locFront = WarehouseLocation.parsePath("WH1-GENERAL-A01-R01-S01-B01", 50000, 10);
      // Loc3: FAST zone, front aisle A02 (score: 50 + 30 = 80)
      const locFastFront = WarehouseLocation.parsePath("WH1-FAST-A02-R01-S01-B01", 50000, 10);

      // Return them in non-optimal order
      mockLocationRepo.findAll.mockResolvedValue([locBack, locFront, locFastFront]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);
      mockProductRepo.findBySkus.mockResolvedValue([]);

      const suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);
      const suggestions = await suggester.suggestPutaway(SKU.create("FAST-SKU"), 10);

      // Highest score locFastFront should be selected first
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].locationId).toBe(locFastFront.id.value);
    });

    it("should ignore locations with zero or negative maximum weight or volume", async () => {
      const product = new Product("PROD-1", "Standard Product");
      product.addVariant(SKU.create("STD-SKU"), [new VariantAttribute("size", "M")], 100, 0.05);
      mockProductRepo.findBySku.mockResolvedValue(product);

      // Locations with corrupted or zero capacities
      const zeroWeightLoc = {
        id: new LocationId("WH1-GENERAL-A01-R01-S01-B01"),
        warehouseId: "WH1",
        zone: "GENERAL",
        aisle: "A01",
        rack: "R01",
        shelf: "S01",
        bin: "B01",
        maxWeightGrams: 0,
        maxVolumeCubicMeters: 10,
      } as WarehouseLocation;

      const zeroVolumeLoc = {
        id: new LocationId("WH1-GENERAL-A02-R01-S01-B01"),
        warehouseId: "WH1",
        zone: "GENERAL",
        aisle: "A02",
        rack: "R01",
        shelf: "S01",
        bin: "B01",
        maxWeightGrams: 10000,
        maxVolumeCubicMeters: 0,
      } as WarehouseLocation;

      const validLoc = WarehouseLocation.parsePath("WH1-GENERAL-A03-R01-S01-B01", 10000, 10);

      mockLocationRepo.findAll.mockResolvedValue([zeroWeightLoc, zeroVolumeLoc, validLoc]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);
      mockProductRepo.findBySkus.mockResolvedValue([]);

      const suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);
      const suggestions = await suggester.suggestPutaway(SKU.create("STD-SKU"), 5);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].locationId).toBe(validLoc.id.value);
    });

    it("should return empty array when no location capacities match requirements", async () => {
      const product = new Product("PROD-1", "Standard Product");
      product.addVariant(
        SKU.create("COLD-SKU"),
        [new VariantAttribute("temperatureZone", "cold")],
        100,
        0.05
      );
      mockProductRepo.findBySku.mockResolvedValue(product);

      // All locations are AMBIENT or HAZMAT (no cold locations)
      const ambientLoc = WarehouseLocation.parsePath("WH1-AMBIENT-A01-R01-S01-B01", 10000, 10);
      const hazmatLoc = WarehouseLocation.parsePath("WH1-HAZMAT-A02-R01-S01-B01", 10000, 10);
      mockLocationRepo.findAll.mockResolvedValue([ambientLoc, hazmatLoc]);

      const suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);
      const suggestions = await suggester.suggestPutaway(SKU.create("COLD-SKU"), 5);

      expect(suggestions).toEqual([]);
    });
  });

  describe("Inventory Lookup & Deductions", () => {
    it("should fall back to findAll() when findAllByLocationIds is not provided", async () => {
      const product = new Product("PROD-1", "Standard Product");
      product.addVariant(SKU.create("STD-SKU"), [new VariantAttribute("size", "M")], 100, 0.05);
      mockProductRepo.findBySku.mockResolvedValue(product);

      const loc1 = WarehouseLocation.parsePath("WH1-ZONE1-A01-R01-S01-B01", 1000, 1.0);
      mockLocationRepo.findAll.mockResolvedValue([loc1]);

      // Remove findAllByLocationIds to trigger fallback
      delete mockInventoryRepo.findAllByLocationIds;

      const existingItem = InventoryItem.create(
        "inv-1",
        SKU.create("EXISTING-SKU"),
        loc1.id.value,
        Quantity.create(2)
      );
      const otherLocItem = InventoryItem.create(
        "inv-2",
        SKU.create("EXISTING-SKU"),
        "OTHER-LOC",
        Quantity.create(5)
      );
      mockInventoryRepo.findAll.mockResolvedValue([existingItem, otherLocItem]);

      const existingProd = new Product("PROD-2", "Existing Item");
      existingProd.addVariant(SKU.create("EXISTING-SKU"), [new VariantAttribute("type", "accessory")], 200, 0.2);
      mockProductRepo.findBySkus.mockResolvedValue([existingProd]);

      const suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);
      const suggestions = await suggester.suggestPutaway(SKU.create("STD-SKU"), 4);

      // Initial: 1000g, 1.0 m3
      // Existing item: 2 * 200g = 400g, 2 * 0.2 m3 = 0.4 m3
      // Remaining: 600g, 0.6 m3
      // Fit for STD-SKU (100g, 0.05 m3):
      // weight limit: 600 / 100 = 6
      // volume limit: 0.6 / 0.05 = 12
      // Fits 4 requested units easily
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].locationId).toBe(loc1.id.value);
      expect(suggestions[0].quantity).toBe(4);
      expect(suggestions[0].remainingWeightGrams).toBe(600 - 4 * 100);
      expect(suggestions[0].remainingVolumeCubicMeters).toBeCloseTo(0.6 - 4 * 0.05);
    });

    it("should correctly chunk locationIds when querying findAllByLocationIds with > 500 locations", async () => {
      const product = new Product("PROD-1", "Standard Product");
      product.addVariant(SKU.create("STD-SKU"), [new VariantAttribute("size", "M")], 100, 0.05);
      mockProductRepo.findBySku.mockResolvedValue(product);

      // Create 550 mock locations
      const locations: WarehouseLocation[] = [];
      for (let i = 1; i <= 550; i++) {
        locations.push(
          WarehouseLocation.parsePath(`WH1-ZONE-A${String(i).padStart(3, "0")}-R01-S01-B01`, 1000, 1.0)
        );
      }
      mockLocationRepo.findAll.mockResolvedValue(locations);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);
      mockProductRepo.findBySkus.mockResolvedValue([]);

      const suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);
      const suggestions = await suggester.suggestPutaway(SKU.create("STD-SKU"), 5);

      // Verify that findAllByLocationIds was invoked in chunks (500 + 50)
      expect(mockInventoryRepo.findAllByLocationIds).toHaveBeenCalledTimes(2);
      expect(mockInventoryRepo.findAllByLocationIds.mock.calls[0][0]).toHaveLength(500);
      expect(mockInventoryRepo.findAllByLocationIds.mock.calls[1][0]).toHaveLength(50);
      expect(suggestions).toBeDefined();
    });
  });

  describe("Multi-Location Splitting & Capacity Boundaries", () => {
    it("should split allocation across multiple locations when single location has insufficient capacity", async () => {
      const product = new Product("PROD-1", "Heavy Large Item");
      product.addVariant(SKU.create("HEAVY-SKU"), [new VariantAttribute("type", "heavy")], 500, 0.5);
      mockProductRepo.findBySku.mockResolvedValue(product);

      // Loc1 can fit at most 2 units (1000g, 1.0 m3)
      const loc1 = WarehouseLocation.parsePath("WH1-ZONE1-A01-R01-S01-B01", 1000, 1.0);
      // Loc2 can fit at most 3 units (1500g, 1.5 m3)
      const loc2 = WarehouseLocation.parsePath("WH1-ZONE1-A02-R01-S01-B01", 1500, 1.5);

      mockLocationRepo.findAll.mockResolvedValue([loc1, loc2]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);
      mockProductRepo.findBySkus.mockResolvedValue([]);

      const suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);
      // Request 5 units total
      const suggestions = await suggester.suggestPutaway(SKU.create("HEAVY-SKU"), 5);

      expect(suggestions).toHaveLength(2);
      // Loc2 has larger remaining weight (1500 vs 1000) so sorted first (both score 0)
      expect(suggestions[0].locationId).toBe(loc2.id.value);
      expect(suggestions[0].quantity).toBe(3);
      expect(suggestions[0].remainingWeightGrams).toBe(0);
      expect(suggestions[0].remainingVolumeCubicMeters).toBe(0);

      expect(suggestions[1].locationId).toBe(loc1.id.value);
      expect(suggestions[1].quantity).toBe(2);
      expect(suggestions[1].remainingWeightGrams).toBe(0);
      expect(suggestions[1].remainingVolumeCubicMeters).toBe(0);
    });

    it("should skip candidate locations that have 0 remaining fit after rounding down", async () => {
      const product = new Product("PROD-1", "Heavy Item");
      // Weight 500g, Volume 0.5 m3
      product.addVariant(SKU.create("HEAVY-SKU"), [new VariantAttribute("type", "heavy")], 500, 0.5);
      mockProductRepo.findBySku.mockResolvedValue(product);

      // Loc1: Has 200g remaining (less than 1 unit = 500g), so maxUnitsToFit = 0
      const loc1 = WarehouseLocation.parsePath("WH1-ZONE1-A01-R01-S01-B01", 200, 1.0);
      // Loc2: Has 1000g remaining (fits 2 units)
      const loc2 = WarehouseLocation.parsePath("WH1-ZONE1-A02-R01-S01-B01", 1000, 1.0);

      mockLocationRepo.findAll.mockResolvedValue([loc1, loc2]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);
      mockProductRepo.findBySkus.mockResolvedValue([]);

      const suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);
      const suggestions = await suggester.suggestPutaway(SKU.create("HEAVY-SKU"), 2);

      // Loc1 is skipped because maxUnitsToFit = 0, loc2 takes both units
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].locationId).toBe(loc2.id.value);
      expect(suggestions[0].quantity).toBe(2);
    });

    it("should throw an error when total warehouse capacity is insufficient for full quantity", async () => {
      const product = new Product("PROD-1", "Heavy Item");
      product.addVariant(SKU.create("HEAVY-SKU"), [new VariantAttribute("type", "heavy")], 1000, 1.0);
      mockProductRepo.findBySku.mockResolvedValue(product);

      // Total capacity across both locations is 3 units
      const loc1 = WarehouseLocation.parsePath("WH1-ZONE1-A01-R01-S01-B01", 1000, 1.0);
      const loc2 = WarehouseLocation.parsePath("WH1-ZONE1-A02-R01-S01-B01", 2000, 2.0);

      mockLocationRepo.findAll.mockResolvedValue([loc1, loc2]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);
      mockProductRepo.findBySkus.mockResolvedValue([]);

      const suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);

      // Request 4 units when only 3 can fit
      await expect(suggester.suggestPutaway(SKU.create("HEAVY-SKU"), 4)).rejects.toThrow(
        "Insufficient warehouse capacity to put away the entire quantity of 4 units for SKU HEAVY-SKU."
      );
    });

    it("should handle weightless and volumeless items without division by zero errors", async () => {
      const product = new Product("PROD-DIGITAL", "Digital License Card");
      // Zero weight and volume
      product.addVariant(SKU.create("ZERO-SKU"), [new VariantAttribute("type", "digital")], 0, 0);
      mockProductRepo.findBySku.mockResolvedValue(product);

      const loc = WarehouseLocation.parsePath("WH1-ZONE1-A01-R01-S01-B01", 500, 0.5);
      mockLocationRepo.findAll.mockResolvedValue([loc]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);
      mockProductRepo.findBySkus.mockResolvedValue([]);

      const suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);
      const suggestions = await suggester.suggestPutaway(SKU.create("ZERO-SKU"), 100);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].locationId).toBe(loc.id.value);
      expect(suggestions[0].quantity).toBe(100);
      expect(suggestions[0].remainingWeightGrams).toBe(500);
      expect(suggestions[0].remainingVolumeCubicMeters).toBe(0.5);
    });
  });
});
