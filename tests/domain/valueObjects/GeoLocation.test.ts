import { GeoLocation } from "../../../src/domain/valueObjects/GeoLocation";

describe("GeoLocation Value Object", () => {
  it("should create a valid geolocation", () => {
    const geo = GeoLocation.create(40.7128, -74.0060);
    expect(geo.getLatitude()).toBe(40.7128);
    expect(geo.getLongitude()).toBe(-74.0060);
  });

  it("should throw error for invalid latitudes", () => {
    expect(() => GeoLocation.create(-95, 0)).toThrow();
    expect(() => GeoLocation.create(91, 0)).toThrow();
  });

  it("should throw error for invalid longitudes", () => {
    expect(() => GeoLocation.create(0, -181)).toThrow();
    expect(() => GeoLocation.create(0, 185)).toThrow();
  });

  it("should compute distance accurately using Haversine formula", () => {
    // New York: 40.7128, -74.0060
    const ny = GeoLocation.create(40.7128, -74.0060);
    // Los Angeles: 34.0522, -118.2437
    const la = GeoLocation.create(34.0522, -118.2437);

    const dist = ny.distanceTo(la);
    // Approximate distance between NY and LA is 3935 km ± 50km
    expect(dist).toBeGreaterThan(3900);
    expect(dist).toBeLessThan(4000);
  });

  it("should compute 0 distance for the same location", () => {
    const geo = GeoLocation.create(40.7128, -74.0060);
    expect(geo.distanceTo(geo)).toBe(0);
  });
});
