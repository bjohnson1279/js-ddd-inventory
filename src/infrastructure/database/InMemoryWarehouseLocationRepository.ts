import { IWarehouseLocationRepository } from "../../domain/repositories/IWarehouseLocationRepository";
import { WarehouseLocation } from "../../domain/product/entities/WarehouseLocation";
import { LocationId } from "../../domain/valueObjects/LocationId";

export class InMemoryWarehouseLocationRepository implements IWarehouseLocationRepository {
  private readonly locations: Map<string, WarehouseLocation> = new Map();

  async save(location: WarehouseLocation): Promise<void> {
    this.locations.set(location.id.value, location);
  }

  async findById(id: LocationId): Promise<WarehouseLocation | null> {
    return this.locations.get(id.value) || null;
  }

  async findByIds(ids: LocationId[]): Promise<WarehouseLocation[]> {
    return ids
      .map(id => this.locations.get(id.value))
      .filter((loc): loc is WarehouseLocation => loc !== undefined);
  }

  async delete(id: LocationId): Promise<void> {
    this.locations.delete(id.value);
  }

  async findAll(): Promise<WarehouseLocation[]> {
    return Array.from(this.locations.values());
  }
}
