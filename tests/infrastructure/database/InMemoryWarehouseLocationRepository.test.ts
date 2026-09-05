import { InMemoryWarehouseLocationRepository } from "../../../src/infrastructure/database/InMemoryWarehouseLocationRepository";
import { WarehouseLocation } from "../../../src/domain/product/entities/WarehouseLocation";
import { LocationId } from "../../../src/domain/valueObjects/LocationId";

describe("InMemoryWarehouseLocationRepository", () => {
  let repository: InMemoryWarehouseLocationRepository;

  beforeEach(() => {
    repository = new InMemoryWarehouseLocationRepository();
  });

  const createLocation = (path = "WH1-ZONEA-A03-R02-S01-B10") => {
    return new WarehouseLocation(
      new LocationId(path),
      "WH1",
      "ZONEA",
      "A03",
      "R02",
      "S01",
      "B10",
      1000,
      1
    );
  };

  describe("save and findById", () => {
    it("should save a warehouse location and find it by ID", async () => {
      const location = createLocation();
      await repository.save(location);

      const found = await repository.findById(new LocationId("WH1-ZONEA-A03-R02-S01-B10"));
      expect(found).toBeDefined();
      expect(found?.id.value).toBe("WH1-ZONEA-A03-R02-S01-B10");
      expect(found?.warehouseId).toBe("WH1");
    });

    it("should return null when finding a non-existent location", async () => {
      const found = await repository.findById(new LocationId("NON_EXISTENT-ZONEA-A03-R02-S01-B10"));
      expect(found).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete a saved location", async () => {
      const location = createLocation();
      await repository.save(location);

      await repository.delete(location.id);

      const found = await repository.findById(location.id);
      expect(found).toBeNull();
    });

    it("should not throw error when deleting a non-existent location", async () => {
      await expect(repository.delete(new LocationId("NON_EXISTENT-ZONEA-A03-R02-S01-B10"))).resolves.toBeUndefined();
    });
  });

  describe("findAll", () => {
    it("should return all saved locations", async () => {
      const loc1 = createLocation("WH1-ZONEA-A01-R01-S01-B01");
      const loc2 = createLocation("WH1-ZONEA-A01-R01-S01-B02");

      await repository.save(loc1);
      await repository.save(loc2);

      const all = await repository.findAll();
      expect(all.length).toBe(2);
      expect(all.map(l => l.id.value)).toContain("WH1-ZONEA-A01-R01-S01-B01");
      expect(all.map(l => l.id.value)).toContain("WH1-ZONEA-A01-R01-S01-B02");
    });

    it("should return empty array when no locations are saved", async () => {
      const all = await repository.findAll();
      expect(all).toEqual([]);
    });
  });
});
