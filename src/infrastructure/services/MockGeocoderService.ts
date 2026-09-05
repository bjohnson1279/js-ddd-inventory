import { IGeocoderService } from "../../application/ports/IGeocoderService";
import { GeoLocation } from "../../domain/valueObjects/GeoLocation";

export class MockGeocoderService implements IGeocoderService {
  geocode(address: string): GeoLocation {
    const normalized = address.toLowerCase();

    // Chicago first to avoid "ca" in chicago matching LA
    if (normalized.includes("central") || normalized.includes("wh3") || normalized.includes("chicago") || normalized.includes("il") || normalized.includes("60601")) {
      return GeoLocation.create(41.8781, -87.6298);
    }

    if (normalized.includes("east") || normalized.includes("wh1") || normalized.includes("new york") || normalized.includes("ny") || normalized.includes("10001")) {
      return GeoLocation.create(40.7128, -74.0060);
    }
    if (normalized.includes("west") || normalized.includes("wh2") || normalized.includes("los angeles") || normalized.includes("ca") || normalized.includes("90210")) {
      return GeoLocation.create(34.0522, -118.2437);
    }
    if (normalized.includes("dallas") || normalized.includes("tx") || normalized.includes("75001")) {
      return GeoLocation.create(32.7767, -96.7970);
    }

    // Deterministic fallback based on address string hash
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
      hash = address.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Map hash to US bounding box: Latitude [25, 49], Longitude [-125, -67]
    const lat = 25 + Math.abs(hash % 24);
    const lon = -125 + Math.abs(hash % 58);
    return GeoLocation.create(lat, lon);
  }
}
