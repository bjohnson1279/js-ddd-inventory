import { MockGeocoderService } from "../../../src/infrastructure/services/MockGeocoderService";

describe("MockGeocoderService", () => {
  let service: MockGeocoderService;

  beforeEach(() => {
    service = new MockGeocoderService();
  });

  describe("geocode", () => {
    it("returns correct location for New York/East/WH1", () => {
      const result1 = service.geocode("new york");
      const result2 = service.geocode("EAST");
      const result3 = service.geocode("wh1");
      const result4 = service.geocode("NY");
      const result5 = service.geocode("10001");

      expect(result1.getLatitude()).toBe(40.7128);
      expect(result1.getLongitude()).toBe(-74.0060);
      expect(result2.getLatitude()).toBe(40.7128);
      expect(result3.getLatitude()).toBe(40.7128);
      expect(result4.getLatitude()).toBe(40.7128);
      expect(result5.getLatitude()).toBe(40.7128);
    });

    it("returns correct location for Los Angeles/West/WH2", () => {
      const result1 = service.geocode("Los Angeles");
      const result2 = service.geocode("west");
      const result3 = service.geocode("wh2");
      const result4 = service.geocode("CA");
      const result5 = service.geocode("90210");

      expect(result1.getLatitude()).toBe(34.0522);
      expect(result1.getLongitude()).toBe(-118.2437);
      expect(result2.getLatitude()).toBe(34.0522);
      expect(result3.getLatitude()).toBe(34.0522);
      expect(result4.getLatitude()).toBe(34.0522);
      expect(result5.getLatitude()).toBe(34.0522);
    });

    it("returns correct location for Chicago/Central/WH3", () => {
      const result1 = service.geocode("chicago");
      const result2 = service.geocode("central");
      const result3 = service.geocode("wh3");
      const result4 = service.geocode("il");
      const result5 = service.geocode("60601");

      expect(result1.getLatitude()).toBe(41.8781);
      expect(result1.getLongitude()).toBe(-87.6298);
      expect(result2.getLatitude()).toBe(41.8781);
      expect(result3.getLatitude()).toBe(41.8781);
      expect(result4.getLatitude()).toBe(41.8781);
      expect(result5.getLatitude()).toBe(41.8781);
    });

    it("returns correct location for Dallas", () => {
      const result1 = service.geocode("Dallas");
      const result2 = service.geocode("TX");
      const result3 = service.geocode("75001");

      expect(result1.getLatitude()).toBe(32.7767);
      expect(result1.getLongitude()).toBe(-96.7970);
      expect(result2.getLatitude()).toBe(32.7767);
      expect(result3.getLatitude()).toBe(32.7767);
    });

    it("returns a deterministic fallback for unknown addresses", () => {
      const result1 = service.geocode("Unknown City");
      const result2 = service.geocode("Unknown City");
      const result3 = service.geocode("Another Random Place");

      // Check deterministic nature
      expect(result1.getLatitude()).toBe(result2.getLatitude());
      expect(result1.getLongitude()).toBe(result2.getLongitude());

      // Check different inputs give (usually) different results
      expect(result1.getLatitude() === result3.getLatitude() && result1.getLongitude() === result3.getLongitude()).toBeFalsy();

      // Check bounds mapping
      expect(result1.getLatitude()).toBeGreaterThanOrEqual(25);
      expect(result1.getLatitude()).toBeLessThanOrEqual(49);
      expect(result1.getLongitude()).toBeGreaterThanOrEqual(-125);
      expect(result1.getLongitude()).toBeLessThanOrEqual(-67);
    });
  });
});
