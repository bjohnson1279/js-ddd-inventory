import { PutawaySuggester } from "../../../src/domain/services/PutawaySuggester";
import { WarehouseLocation } from "../../../src/domain/product/entities/WarehouseLocation";
import { LocationId } from "../../../src/domain/valueObjects/LocationId";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Product } from "../../../src/domain/product/aggregates/Product";
import { VariantAttribute } from "../../../src/domain/product/valueObjects/VariantAttribute";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";

describe("PutawaySuggester", () => {
  let mockInventoryRepo: any;
  let mockProductRepo: any;
  let mockLocationRepo: any;
  let suggester: PutawaySuggester;

  beforeEach(() => {
    mockInventoryRepo = {
      findAll: jest.fn(),
      findAllByLocationIds: jest.fn()
    };
    mockProductRepo = {
      findBySku: jest.fn(),
      findBySkus: jest.fn()
    };
    mockLocationRepo = {
      findAll: jest.fn()
    };

    suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);
  });

  describe("Validation & Guard Clauses", () => {
    it("should throw an error when quantity is zero or negative", async () => {
      const sku = SKU.create("SKU-TEST");
      await expect(suggester.suggestPutaway(sku, 0)).rejects.toThrow(
        "Quantity to put away must be positive."
      );
      await expect(suggester.suggestPutaway(sku, -5)).rejects.toThrow(
        "Quantity to put away must be positive."
      );
    });

    it("should throw an error when product is not found", async () => {
      const sku = SKU.create("SKU-NONEXISTENT");
      mockProductRepo.findBySku.mockResolvedValue(null);

      await expect(suggester.suggestPutaway(sku, 10)).rejects.toThrow(
        "Product variant with SKU SKU-NONEXISTENT not found."
      );
    });

    it("should throw an error when product exists but does not contain the requested variant SKU", async () => {
      const sku = SKU.create("SKU-MISSING-VARIANT");
      const product = new Product("PROD-1", "Product 1");
      product.addVariant(SKU.create("SKU-OTHER"), [new VariantAttribute("size", "M")], 100, 1.0);
      mockProductRepo.findBySku.mockResolvedValue(product);

      await expect(suggester.suggestPutaway(sku, 10)).rejects.toThrow(
        "Product variant with SKU SKU-MISSING-VARIANT not found."
      );
    });

    it("should return an empty array when no locations exist in the warehouse", async () => {
      const sku = SKU.create("SKU-1");
      const product = new Product("PROD-1", "Product 1");
      product.addVariant(sku, [new VariantAttribute("type", "standard")], 100, 1.0);
      mockProductRepo.findBySku.mockResolvedValue(product);
      mockLocationRepo.findAll.mockResolvedValue([]);

      const result = await suggester.suggestPutaway(sku, 5);
      expect(result).toEqual([]);
    });

    it("should return empty array if no locations match the zone requirements", async () => {
      const sku = SKU.create("FROZEN-SKU");
      const product = new Product("PROD-1", "Ice");
      product.addVariant(
        sku,
        [new VariantAttribute("temperatureZone", "FREEZER")],
        100,
        0.1
      );
      mockProductRepo.findBySku.mockResolvedValue(product);

      const locAmbient = new WarehouseLocation(
        new LocationId("LOC-AMBIENT"),
        "WH1", "AMBIENT", "A01", "R01", "S01", "B01", 1000, 5.0, 1, 1
      );
      mockLocationRepo.findAll.mockResolvedValue([locAmbient]);

      const result = await suggester.suggestPutaway(sku, 5);
      expect(result).toEqual([]);
    });
  });

  describe("Zone Filtering & Scoring", () => {
    it("should require matching temperature zone when variant specifies temperatureZone", async () => {
      const sku = SKU.create("COLD-ITEM");
      const product = new Product("PROD-1", "Frozen Goods");
      product.addVariant(
        sku,
        [new VariantAttribute("temperatureZone", "COLD")],
        100,
        0.1
      );
      mockProductRepo.findBySku.mockResolvedValue(product);

      const coldLoc = new WarehouseLocation(
        new LocationId("LOC-COLD"),
        "WH1", "COLD", "A01", "R01", "S01", "B01", 1000, 5.0, 1, 1
      );
      const ambientLoc = new WarehouseLocation(
        new LocationId("LOC-AMBIENT"),
        "WH1", "AMBIENT", "A01", "R01", "S01", "B01", 1000, 5.0, 1, 1
      );
      mockLocationRepo.findAll.mockResolvedValue([coldLoc, ambientLoc]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);

      const result = await suggester.suggestPutaway(sku, 5);
      expect(result).toHaveLength(1);
      expect(result[0].locationId).toBe("LOC-COLD");
      expect(result[0].quantity).toBe(5);
    });

    it("should prioritize hazmat zone (+200 score) when variant specifies hazardClass", async () => {
      const sku = SKU.create("HAZMAT-ITEM");
      const product = new Product("PROD-1", "Chemicals");
      product.addVariant(
        sku,
        [new VariantAttribute("hazardClass", "flammable")],
        100,
        0.1
      );
      mockProductRepo.findBySku.mockResolvedValue(product);

      const hazmatLoc = new WarehouseLocation(
        new LocationId("LOC-HAZMAT"),
        "WH1", "HAZMAT", "A05", "R01", "S01", "B01", 1000, 5.0, 1, 1
      );
      const standardLoc = new WarehouseLocation(
        new LocationId("LOC-STD"),
        "WH1", "STANDARD", "A01", "R01", "S01", "B01", 1000, 5.0, 1, 1
      );
      mockLocationRepo.findAll.mockResolvedValue([hazmatLoc, standardLoc]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);

      const result = await suggester.suggestPutaway(sku, 5);
      expect(result).toHaveLength(1);
      expect(result[0].locationId).toBe("LOC-HAZMAT");
    });

    it("should exclude hazmat zones for standard items without hazardClass", async () => {
      const sku = SKU.create("SAFE-ITEM");
      const product = new Product("PROD-1", "Cotton T-Shirt");
      product.addVariant(sku, [new VariantAttribute("material", "cotton")], 100, 0.1);
      mockProductRepo.findBySku.mockResolvedValue(product);

      const hazmatLoc = new WarehouseLocation(
        new LocationId("LOC-HAZMAT"),
        "WH1", "HAZMAT", "A05", "R01", "S01", "B01", 1000, 5.0, 1, 1
      );
      const standardLoc = new WarehouseLocation(
        new LocationId("LOC-STD"),
        "WH1", "GENERAL", "A04", "R01", "S01", "B01", 1000, 5.0, 1, 1
      );
      mockLocationRepo.findAll.mockResolvedValue([hazmatLoc, standardLoc]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);

      const result = await suggester.suggestPutaway(sku, 2);
      expect(result).toHaveLength(1);
      expect(result[0].locationId).toBe("LOC-STD");
    });

    it("should score fast-moving items higher in FAST zone (+50) and front aisles A01-A03 (+30)", async () => {
      const sku = SKU.create("FAST-SKU");
      const product = new Product("PROD-1", "Popular Gadget");
      product.addVariant(
        sku,
        [new VariantAttribute("velocity", "fast-moving")],
        50,
        0.05
      );
      mockProductRepo.findBySku.mockResolvedValue(product);

      const locFastFront = new WarehouseLocation(
        new LocationId("LOC-FAST-A01"),
        "WH1", "FAST", "A01", "R01", "S01", "B01", 1000, 5.0, 1, 1
      ); // score: 50 + 30 = 80
      const locFastBack = new WarehouseLocation(
        new LocationId("LOC-FAST-A08"),
        "WH1", "FAST", "A08", "R01", "S01", "B01", 1000, 5.0, 1, 1
      ); // score: 50
      const locStandardFront = new WarehouseLocation(
        new LocationId("LOC-STD-A02"),
        "WH1", "STANDARD", "A02", "R01", "S01", "B01", 1000, 5.0, 1, 1
      ); // score: 30
      const locStandardBack = new WarehouseLocation(
        new LocationId("LOC-STD-A09"),
        "WH1", "STANDARD", "A09", "R01", "S01", "B01", 1000, 5.0, 1, 1
      ); // score: 0

      mockLocationRepo.findAll.mockResolvedValue([
        locStandardBack,
        locStandardFront,
        locFastBack,
        locFastFront
      ]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);

      const result = await suggester.suggestPutaway(sku, 5);
      expect(result[0].locationId).toBe("LOC-FAST-A01");
    });

    it("should skip location candidates that have 0 or negative capacity via location object properties", async () => {
      const sku = SKU.create("SKU-1");
      const product = new Product("PROD-1", "Item");
      product.addVariant(sku, [new VariantAttribute("type", "standard")], 100, 0.1);
      mockProductRepo.findBySku.mockResolvedValue(product);

      const mockZeroWeightLoc: any = {
        id: { value: "LOC-ZERO-W" },
        warehouseId: "WH1",
        zone: "GENERAL",
        aisle: "A01",
        rack: "R01",
        shelf: "S01",
        bin: "B01",
        maxWeightGrams: 0,
        maxVolumeCubicMeters: 5.0
      };
      const mockZeroVolumeLoc: any = {
        id: { value: "LOC-ZERO-V" },
        warehouseId: "WH1",
        zone: "GENERAL",
        aisle: "A01",
        rack: "R01",
        shelf: "S01",
        bin: "B01",
        maxWeightGrams: 1000,
        maxVolumeCubicMeters: 0
      };
      mockLocationRepo.findAll.mockResolvedValue([mockZeroWeightLoc, mockZeroVolumeLoc]);

      const result = await suggester.suggestPutaway(sku, 5);
      expect(result).toEqual([]);
    });
  });

  describe("Inventory Deduplication & Capacity Allocation", () => {
    it("should reduce available location capacity based on existing inventory items using findAllByLocationIds", async () => {
      const sku = SKU.create("TARGET-SKU");
      const product = new Product("PROD-1", "Target Product");
      product.addVariant(sku, [new VariantAttribute("category", "target")], 100, 1.0); // 100g, 1.0 m3
      mockProductRepo.findBySku.mockResolvedValue(product);

      const loc = new WarehouseLocation(
        new LocationId("LOC-1"),
        "WH1", "GENERAL", "A01", "R01", "S01", "B01", 1000, 10.0, 1, 1
      );
      mockLocationRepo.findAll.mockResolvedValue([loc]);

      // Existing inventory at LOC-1 occupies 400g and 4.0 m3 (4 units of OTHER-SKU at 100g, 1.0 m3)
      const otherSku = SKU.create("OTHER-SKU");
      const otherProd = new Product("PROD-2", "Other Product");
      otherProd.addVariant(otherSku, [new VariantAttribute("category", "other")], 100, 1.0);

      const existingItem = InventoryItem.create("inv-1", otherSku, "LOC-1", Quantity.create(4));
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([existingItem]);
      mockProductRepo.findBySkus.mockResolvedValue([otherProd]);

      // Remaining at LOC-1 should be 1000 - 400 = 600g, 10.0 - 4.0 = 6.0 m3 -> fits up to 6 units
      const result = await suggester.suggestPutaway(sku, 5);
      expect(result).toHaveLength(1);
      expect(result[0].locationId).toBe("LOC-1");
      expect(result[0].quantity).toBe(5);
      expect(result[0].remainingWeightGrams).toBe(100); // 600 - 500 = 100
      expect(result[0].remainingVolumeCubicMeters).toBe(1.0); // 6.0 - 5.0 = 1.0
    });

    it("should fallback to findAll on inventory repository when findAllByLocationIds is absent", async () => {
      const fallbackInventoryRepo: any = {
        findAll: jest.fn()
      };
      const fallbackSuggester = new PutawaySuggester(
        fallbackInventoryRepo,
        mockProductRepo,
        mockLocationRepo
      );

      const sku = SKU.create("TARGET-SKU");
      const product = new Product("PROD-1", "Target Product");
      product.addVariant(sku, [new VariantAttribute("category", "target")], 50, 0.5);
      mockProductRepo.findBySku.mockResolvedValue(product);

      const loc1 = new WarehouseLocation(
        new LocationId("LOC-1"),
        "WH1", "GENERAL", "A01", "R01", "S01", "B01", 500, 5.0, 1, 1
      );
      const loc2 = new WarehouseLocation(
        new LocationId("LOC-2"),
        "WH1", "GENERAL", "A02", "R01", "S01", "B01", 500, 5.0, 1, 1
      );
      mockLocationRepo.findAll.mockResolvedValue([loc1, loc2]);

      const itemAtLoc1 = InventoryItem.create("inv-1", sku, "LOC-1", Quantity.create(2));
      const itemAtUnrelated = InventoryItem.create("inv-2", sku, "UNRELATED-LOC", Quantity.create(10));
      fallbackInventoryRepo.findAll.mockResolvedValue([itemAtLoc1, itemAtUnrelated]);
      mockProductRepo.findBySkus.mockResolvedValue([product]);

      const result = await fallbackSuggester.suggestPutaway(sku, 4);
      expect(result).toHaveLength(1);
      expect(result[0].locationId).toBe("LOC-2");
      expect(result[0].quantity).toBe(4);
    });

    it("should split allocation across multiple candidate locations when single location cannot fit entire quantity", async () => {
      const sku = SKU.create("BULK-SKU");
      const product = new Product("PROD-1", "Bulk Item");
      product.addVariant(sku, [new VariantAttribute("category", "bulk")], 200, 2.0); // 200g, 2.0 m3
      mockProductRepo.findBySku.mockResolvedValue(product);

      // LOC-1 can fit 3 units (600g / 6m3)
      const loc1 = new WarehouseLocation(
        new LocationId("LOC-1"),
        "WH1", "GENERAL", "A01", "R01", "S01", "B01", 600, 6.0, 1, 1
      );
      // LOC-2 can fit 4 units (800g / 8m3)
      const loc2 = new WarehouseLocation(
        new LocationId("LOC-2"),
        "WH1", "GENERAL", "A02", "R01", "S01", "B01", 800, 8.0, 1, 1
      );

      mockLocationRepo.findAll.mockResolvedValue([loc1, loc2]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);

      // Request 5 units (loc2 gets sorted first due to higher remaining weight 800 vs 600)
      const result = await suggester.suggestPutaway(sku, 5);
      expect(result).toHaveLength(2);

      // 4 units in LOC-2 (remaining 0g, 0m3)
      expect(result[0].locationId).toBe("LOC-2");
      expect(result[0].quantity).toBe(4);
      expect(result[0].remainingWeightGrams).toBe(0);
      expect(result[0].remainingVolumeCubicMeters).toBe(0);

      // 1 unit in LOC-1 (remaining 400g, 4.0m3)
      expect(result[1].locationId).toBe("LOC-1");
      expect(result[1].quantity).toBe(1);
      expect(result[1].remainingWeightGrams).toBe(400);
      expect(result[1].remainingVolumeCubicMeters).toBe(4.0);
    });

    it("should stop allocating further locations when remainingToAllocate reaches 0 early", async () => {
      const sku = SKU.create("TEST-ITEM");
      const product = new Product("PROD-1", "Item");
      product.addVariant(sku, [new VariantAttribute("cat", "item")], 100, 1.0);
      mockProductRepo.findBySku.mockResolvedValue(product);

      const loc1 = new WarehouseLocation(
        new LocationId("LOC-1"),
        "WH1", "GENERAL", "A01", "R01", "S01", "B01", 1000, 10.0, 1, 1
      );
      const loc2 = new WarehouseLocation(
        new LocationId("LOC-2"),
        "WH1", "GENERAL", "A02", "R01", "S01", "B01", 1000, 10.0, 1, 1
      );
      mockLocationRepo.findAll.mockResolvedValue([loc1, loc2]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);

      // Allocate 5 units: fits fully into loc1 (or loc2). Second location should not receive any recommendation.
      const result = await suggester.suggestPutaway(sku, 5);
      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(5);
    });

    it("should throw an error when total warehouse capacity is insufficient for requested quantity", async () => {
      const sku = SKU.create("HEAVY-SKU");
      const product = new Product("PROD-1", "Heavy Anvil");
      product.addVariant(sku, [new VariantAttribute("weight", "heavy")], 1000, 5.0);
      mockProductRepo.findBySku.mockResolvedValue(product);

      const loc = new WarehouseLocation(
        new LocationId("LOC-TINY"),
        "WH1", "GENERAL", "A01", "R01", "S01", "B01", 1500, 6.0, 1, 1
      );
      mockLocationRepo.findAll.mockResolvedValue([loc]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);

      // 1500g fits 1 unit, but we request 3 units
      await expect(suggester.suggestPutaway(sku, 3)).rejects.toThrow(
        "Insufficient warehouse capacity to put away the entire quantity of 3 units for SKU HEAVY-SKU."
      );
    });

    it("should handle zero-weight and zero-volume variants (infinite capacity limit)", async () => {
      const sku = SKU.create("DIGITAL-LICENSE");
      const product = new Product("PROD-1", "Software Card");
      product.addVariant(sku, [new VariantAttribute("format", "digital")], 0, 0); // 0g, 0m3
      mockProductRepo.findBySku.mockResolvedValue(product);

      const loc = new WarehouseLocation(
        new LocationId("LOC-CARD"),
        "WH1", "GENERAL", "A01", "R01", "S01", "B01", 50, 0.1, 1, 1
      );
      mockLocationRepo.findAll.mockResolvedValue([loc]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);

      const result = await suggester.suggestPutaway(sku, 100);
      expect(result).toHaveLength(1);
      expect(result[0].locationId).toBe("LOC-CARD");
      expect(result[0].quantity).toBe(100);
    });

    it("should skip candidate locations when existing inventory has exhausted their remaining capacity", async () => {
      const sku = SKU.create("BOX-SKU");
      const product = new Product("PROD-1", "Box Item");
      product.addVariant(sku, [new VariantAttribute("type", "box")], 100, 1.0);
      mockProductRepo.findBySku.mockResolvedValue(product);

      // LOC-FULL is completely filled by existing inventory
      const locFull = new WarehouseLocation(
        new LocationId("LOC-FULL"),
        "WH1", "GENERAL", "A01", "R01", "S01", "B01", 500, 5.0, 1, 1
      );
      // LOC-FREE has room
      const locFree = new WarehouseLocation(
        new LocationId("LOC-FREE"),
        "WH1", "GENERAL", "A02", "R01", "S01", "B01", 500, 5.0, 1, 1
      );
      mockLocationRepo.findAll.mockResolvedValue([locFull, locFree]);

      const fillSku = SKU.create("FILL-SKU");
      const fillProd = new Product("PROD-FILL", "Filler");
      fillProd.addVariant(fillSku, [new VariantAttribute("type", "filler")], 500, 5.0);

      const existingFullItem = InventoryItem.create("inv-full", fillSku, "LOC-FULL", Quantity.create(1));
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([existingFullItem]);
      mockProductRepo.findBySkus.mockResolvedValue([fillProd]);

      const result = await suggester.suggestPutaway(sku, 2);
      expect(result).toHaveLength(1);
      expect(result[0].locationId).toBe("LOC-FREE");
      expect(result[0].quantity).toBe(2);
    });

    it("should skip locations where remaining capacity can fit 0 units of variant", async () => {
      const sku = SKU.create("BULK-ITEM");
      const product = new Product("PROD-1", "Large Box");
      product.addVariant(sku, [new VariantAttribute("type", "large")], 600, 6.0); // 600g, 6m3
      mockProductRepo.findBySku.mockResolvedValue(product);

      // LOC-1 has 500g, 5.0m3 remaining (< 600g, 6.0m3 so maxUnitsToFit = 0)
      const loc1 = new WarehouseLocation(
        new LocationId("LOC-1"),
        "WH1", "GENERAL", "A01", "R01", "S01", "B01", 500, 5.0, 1, 1
      );
      // LOC-2 has 1200g, 12.0m3 remaining (fits 2 units)
      const loc2 = new WarehouseLocation(
        new LocationId("LOC-2"),
        "WH1", "GENERAL", "A02", "R01", "S01", "B01", 1200, 12.0, 1, 1
      );

      mockLocationRepo.findAll.mockResolvedValue([loc1, loc2]);
      mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);

      const result = await suggester.suggestPutaway(sku, 2);
      expect(result).toHaveLength(1);
      expect(result[0].locationId).toBe("LOC-2");
      expect(result[0].quantity).toBe(2);
    });
  });
});
