export class GeoLocation {
  private readonly latitude: number;
  private readonly longitude: number;

  private constructor(latitude: number, longitude: number) {
    this.latitude = latitude;
    this.longitude = longitude;
  }

  public static create(latitude: number, longitude: number): GeoLocation {
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      throw new Error("Latitude must be a valid number between -90 and 90");
    }
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      throw new Error("Longitude must be a valid number between -180 and 180");
    }
    return new GeoLocation(latitude, longitude);
  }

  public getLatitude(): number {
    return this.latitude;
  }

  public getLongitude(): number {
    return this.longitude;
  }

  /**
   * Calculates the distance to another geolocation in kilometers using the Haversine formula.
   */
  public distanceTo(other: GeoLocation): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((other.getLatitude() - this.latitude) * Math.PI) / 180;
    const dLon = ((other.getLongitude() - this.longitude) * Math.PI) / 180;
    const lat1 = (this.latitude * Math.PI) / 180;
    const lat2 = (other.getLatitude() * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public equals(other: GeoLocation): boolean {
    return this.latitude === other.getLatitude() && this.longitude === other.getLongitude();
  }
}
