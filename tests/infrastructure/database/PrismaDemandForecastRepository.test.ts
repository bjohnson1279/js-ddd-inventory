import { PrismaDemandForecastRepository } from "../../../src/infrastructure/database/PrismaDemandForecastRepository";
import { DemandForecast } from "../../../src/domain/repositories/IDemandForecastRepository";
import { prisma as sharedPrisma } from "../../../src/infrastructure/database/prisma";

jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    demandForecastModel: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe("PrismaDemandForecastRepository", () => {
  let repo: PrismaDemandForecastRepository;
  const prisma = sharedPrisma;

  beforeEach(() => {
    repo = new PrismaDemandForecastRepository();
    jest.clearAllMocks();
  });

  describe("save", () => {
    it("should upsert a demand forecast record with correct compound key and payload", async () => {
      const periodStart = new Date("2025-01-01T00:00:00Z");
      const periodEnd = new Date("2025-01-07T00:00:00Z");
      const createdAt = new Date("2024-12-31T12:00:00Z");

      const forecast = new DemandForecast(
        "fc-1",
        "SKU-ABC",
        "LOC-01",
        150,
        periodStart,
        periodEnd,
        0.95,
        createdAt
      );

      (prisma.demandForecastModel.upsert as jest.Mock).mockResolvedValueOnce({
        id: "fc-1",
        sku: "SKU-ABC",
        locationId: "LOC-01",
        forecastedQuantity: 150,
        periodStart,
        periodEnd,
        confidenceLevel: 0.95,
        createdAt,
        updatedAt: createdAt,
      });

      await repo.save(forecast);

      expect(prisma.demandForecastModel.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.demandForecastModel.upsert).toHaveBeenCalledWith({
        where: {
          sku_locationId_periodStart_periodEnd: {
            sku: "SKU-ABC",
            locationId: "LOC-01",
            periodStart,
            periodEnd,
          },
        },
        update: {
          forecastedQuantity: 150,
          confidenceLevel: 0.95,
        },
        create: {
          sku: "SKU-ABC",
          locationId: "LOC-01",
          forecastedQuantity: 150,
          periodStart,
          periodEnd,
          confidenceLevel: 0.95,
        },
      });
    });
  });

  describe("findForecast", () => {
    it("should return DemandForecast domain entity when record exists", async () => {
      const periodStart = new Date("2025-02-01T00:00:00Z");
      const periodEnd = new Date("2025-02-28T00:00:00Z");
      const createdAt = new Date("2025-01-15T08:00:00Z");

      (prisma.demandForecastModel.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "fc-2",
        sku: "SKU-XYZ",
        locationId: "LOC-WEST",
        forecastedQuantity: 320,
        periodStart,
        periodEnd,
        confidenceLevel: 0.88,
        createdAt,
        updatedAt: createdAt,
      });

      const result = await repo.findForecast("SKU-XYZ", "LOC-WEST", periodStart, periodEnd);

      expect(prisma.demandForecastModel.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.demandForecastModel.findUnique).toHaveBeenCalledWith({
        where: {
          sku_locationId_periodStart_periodEnd: {
            sku: "SKU-XYZ",
            locationId: "LOC-WEST",
            periodStart,
            periodEnd,
          },
        },
      });

      expect(result).toBeInstanceOf(DemandForecast);
      expect(result).not.toBeNull();
      expect(result?.id).toBe("fc-2");
      expect(result?.sku).toBe("SKU-XYZ");
      expect(result?.locationId).toBe("LOC-WEST");
      expect(result?.forecastedQuantity).toBe(320);
      expect(result?.periodStart).toEqual(periodStart);
      expect(result?.periodEnd).toEqual(periodEnd);
      expect(result?.confidenceLevel).toBe(0.88);
      expect(result?.createdAt).toEqual(createdAt);
    });

    it("should return null when record does not exist", async () => {
      const periodStart = new Date("2025-03-01T00:00:00Z");
      const periodEnd = new Date("2025-03-31T00:00:00Z");

      (prisma.demandForecastModel.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const result = await repo.findForecast("NON-EXISTENT", "LOC-EMPTY", periodStart, periodEnd);

      expect(prisma.demandForecastModel.findUnique).toHaveBeenCalledWith({
        where: {
          sku_locationId_periodStart_periodEnd: {
            sku: "NON-EXISTENT",
            locationId: "LOC-EMPTY",
            periodStart,
            periodEnd,
          },
        },
      });
      expect(result).toBeNull();
    });
  });

  describe("findAllForLocation", () => {
    it("should return list of DemandForecast domain entities sorted by periodStart asc", async () => {
      const d1Start = new Date("2025-01-01T00:00:00Z");
      const d1End = new Date("2025-01-07T00:00:00Z");
      const d2Start = new Date("2025-01-08T00:00:00Z");
      const d2End = new Date("2025-01-14T00:00:00Z");
      const createdAt = new Date("2024-12-20T10:00:00Z");

      (prisma.demandForecastModel.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "fc-10",
          sku: "SKU-1",
          locationId: "LOC-MAIN",
          forecastedQuantity: 50,
          periodStart: d1Start,
          periodEnd: d1End,
          confidenceLevel: 0.9,
          createdAt,
          updatedAt: createdAt,
        },
        {
          id: "fc-11",
          sku: "SKU-2",
          locationId: "LOC-MAIN",
          forecastedQuantity: 80,
          periodStart: d2Start,
          periodEnd: d2End,
          confidenceLevel: 0.85,
          createdAt,
          updatedAt: createdAt,
        },
      ]);

      const results = await repo.findAllForLocation("LOC-MAIN");

      expect(prisma.demandForecastModel.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.demandForecastModel.findMany).toHaveBeenCalledWith({
        where: { locationId: "LOC-MAIN" },
        orderBy: { periodStart: "asc" },
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toBeInstanceOf(DemandForecast);
      expect(results[0].id).toBe("fc-10");
      expect(results[0].sku).toBe("SKU-1");
      expect(results[0].locationId).toBe("LOC-MAIN");
      expect(results[0].forecastedQuantity).toBe(50);
      expect(results[0].periodStart).toEqual(d1Start);
      expect(results[0].periodEnd).toEqual(d1End);
      expect(results[0].confidenceLevel).toBe(0.9);
      expect(results[0].createdAt).toEqual(createdAt);

      expect(results[1]).toBeInstanceOf(DemandForecast);
      expect(results[1].id).toBe("fc-11");
      expect(results[1].sku).toBe("SKU-2");
      expect(results[1].locationId).toBe("LOC-MAIN");
      expect(results[1].forecastedQuantity).toBe(80);
      expect(results[1].periodStart).toEqual(d2Start);
      expect(results[1].periodEnd).toEqual(d2End);
      expect(results[1].confidenceLevel).toBe(0.85);
      expect(results[1].createdAt).toEqual(createdAt);
    });

    it("should return empty array when no forecasts exist for location", async () => {
      (prisma.demandForecastModel.findMany as jest.Mock).mockResolvedValueOnce([]);

      const results = await repo.findAllForLocation("LOC-UNKNOWN");

      expect(prisma.demandForecastModel.findMany).toHaveBeenCalledWith({
        where: { locationId: "LOC-UNKNOWN" },
        orderBy: { periodStart: "asc" },
      });
      expect(results).toEqual([]);
    });
  });
});
