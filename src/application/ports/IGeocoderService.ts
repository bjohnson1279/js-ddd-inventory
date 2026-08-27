import { GeoLocation } from "../../domain/valueObjects/GeoLocation";

export interface IGeocoderService {
  geocode(address: string): GeoLocation;
}
