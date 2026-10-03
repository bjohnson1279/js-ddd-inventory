import { LocationId } from "../valueObjects/LocationId";
import { WarehouseLocation } from "../product/entities/WarehouseLocation";

export interface IWarehouseLocationRepository {
  save(location: WarehouseLocation): Promise<void>;
  findById(id: LocationId): Promise<WarehouseLocation | null>;
  findByIds(ids: LocationId[]): Promise<WarehouseLocation[]>;
  delete(id: LocationId): Promise<void>;
  findAll(): Promise<WarehouseLocation[]>;
}
