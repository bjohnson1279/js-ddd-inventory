import { PrismaWarehouseLocationRepository } from "../../../src/infrastructure/database/PrismaWarehouseLocationRepository";
import { prisma as sharedPrisma } from "../../../src/infrastructure/database/prisma";
import { WarehouseLocation } from "../../../src/domain/product/entities/WarehouseLocation";
import { LocationId } from "../../../src/domain/valueObjects/LocationId";

describe("PrismaWarehouseLocationRepository Integration Tests", () => {
  let prisma = sharedPrisma;
  let repo: PrismaWarehouseLocationRepository;

  beforeAll(() => {
    repo = new PrismaWarehouseLocationRepository();
  });

  beforeEach(async () => {
    try {
      await prisma.warehouseLocationModel.deleteMany();
    } catch {}
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should save and find a warehouse location by ID", async () => {
    const locId = new LocationId("WH1-ZONEA-A03-R02-S01-B10");
    const location = new WarehouseLocation(
      locId,
      "WH1",
      "ZONEA",
      "A03",
      "R02",
      "S01",
      "B10",
      1000,
      2.5,
      1,
      2,
      10,
      20
    );

    await repo.save(location);

    const found = await repo.findById(locId);
    expect(found).not.toBeNull();
    expect(found?.id.value).toBe("WH1-ZONEA-A03-R02-S01-B10");
    expect(found?.warehouseId).toBe("WH1");
    expect(found?.zone).toBe("ZONEA");
    expect(found?.maxWeightGrams).toBe(1000);
    expect(found?.maxVolumeCubicMeters).toBe(2.5);
    expect(found?.gridX).toBe(1);
    expect(found?.gridY).toBe(2);
    expect(found?.width).toBe(10);
    expect(found?.height).toBe(20);
  });

  it("should update an existing warehouse location", async () => {
    const locId = new LocationId("WH1-ZONEA-A03-R02-S01-B11");
    const location = new WarehouseLocation(
      locId,
      "WH1",
      "ZONEA",
      "A03",
      "R02",
      "S01",
      "B11",
      1000,
      2.5
    );

    await repo.save(location);

    // Update fields
    const updatedLocation = new WarehouseLocation(
      locId,
      "WH1",
      "ZONEA",
      "A03",
      "R02",
      "S01",
      "B11",
      2000,
      5.0,
      5,
      5,
      100,
      200
    );

    await repo.save(updatedLocation);

    const found = await repo.findById(locId);
    expect(found?.maxWeightGrams).toBe(2000);
    expect(found?.maxVolumeCubicMeters).toBe(5.0);
    expect(found?.gridX).toBe(5);
  });

  it("should find multiple locations by IDs", async () => {
    const loc1 = new WarehouseLocation(
      new LocationId("LOC-1"),
      "WH1", "Z1", "A1", "R1", "S1", "B1", 100, 1
    );
    const loc2 = new WarehouseLocation(
      new LocationId("LOC-2"),
      "WH1", "Z1", "A1", "R1", "S1", "B2", 100, 1
    );
    const loc3 = new WarehouseLocation(
      new LocationId("LOC-3"),
      "WH1", "Z1", "A1", "R1", "S1", "B3", 100, 1
    );

    await repo.save(loc1);
    await repo.save(loc2);
    await repo.save(loc3);

    const founds = await repo.findByIds([new LocationId("LOC-1"), new LocationId("LOC-3")]);
    expect(founds.length).toBe(2);
    expect(founds.find(f => f.id.value === "LOC-1")).toBeDefined();
    expect(founds.find(f => f.id.value === "LOC-3")).toBeDefined();
    expect(founds.find(f => f.id.value === "LOC-2")).toBeUndefined();
  });

  it("should return null for non-existent location ID", async () => {
    const found = await repo.findById(new LocationId("NON-EXISTENT"));
    expect(found).toBeNull();
  });

  it("should return all locations", async () => {
    const loc1 = new WarehouseLocation(
      new LocationId("LOC-4"),
      "WH2", "Z1", "A1", "R1", "S1", "B1", 100, 1
    );
    const loc2 = new WarehouseLocation(
      new LocationId("LOC-5"),
      "WH2", "Z1", "A1", "R1", "S1", "B2", 100, 1
    );

    await repo.save(loc1);
    await repo.save(loc2);

    const all = await repo.findAll();
    // It might return more if previous tests didn't clean up, but we clean up in beforeEach
    expect(all.length).toBe(2);
    expect(all.find(l => l.id.value === "LOC-4")).toBeDefined();
    expect(all.find(l => l.id.value === "LOC-5")).toBeDefined();
  });

  it("should delete a location", async () => {
    const locId = new LocationId("LOC-TO-DELETE");
    const loc = new WarehouseLocation(
      locId,
      "WH3", "Z1", "A1", "R1", "S1", "B1", 100, 1
    );

    await repo.save(loc);

    let found = await repo.findById(locId);
    expect(found).not.toBeNull();

    await repo.delete(locId);

    found = await repo.findById(locId);
    expect(found).toBeNull();
  });

  it("should not throw when deleting a non-existent location", async () => {
    await expect(repo.delete(new LocationId("NON-EXISTENT"))).resolves.not.toThrow();
  });
});
