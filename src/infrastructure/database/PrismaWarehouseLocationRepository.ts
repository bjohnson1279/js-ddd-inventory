import { IWarehouseLocationRepository } from "../../domain/repositories/IWarehouseLocationRepository";
import { WarehouseLocation } from "../../domain/product/entities/WarehouseLocation";
import { LocationId } from "../../domain/valueObjects/LocationId";
import { prisma } from "./prisma";

export class PrismaWarehouseLocationRepository implements IWarehouseLocationRepository {
  private prisma = prisma;

  async save(location: WarehouseLocation): Promise<void> {
    await this.prisma.warehouseLocationModel.upsert({
      where: { id: location.id.value },
      update: {
        warehouseId: location.warehouseId,
        zone: location.zone,
        aisle: location.aisle,
        rack: location.rack,
        shelf: location.shelf,
        bin: location.bin,
        maxWeightGrams: location.maxWeightGrams,
        maxVolumeCubicMeters: location.maxVolumeCubicMeters
      },
      create: {
        id: location.id.value,
        warehouseId: location.warehouseId,
        zone: location.zone,
        aisle: location.aisle,
        rack: location.rack,
        shelf: location.shelf,
        bin: location.bin,
        maxWeightGrams: location.maxWeightGrams,
        maxVolumeCubicMeters: location.maxVolumeCubicMeters
      }
    });
  }

  async findById(id: LocationId): Promise<WarehouseLocation | null> {
    const model = await this.prisma.warehouseLocationModel.findUnique({
      where: { id: id.value }
    });
    if (!model) return null;

    return new WarehouseLocation(
      new LocationId(model.id),
      model.warehouseId,
      model.zone,
      model.aisle,
      model.rack,
      model.shelf,
      model.bin,
      model.maxWeightGrams,
      model.maxVolumeCubicMeters
    );
  }

  async delete(id: LocationId): Promise<void> {
    await this.prisma.warehouseLocationModel.delete({
      where: { id: id.value }
    }).catch(() => {}); // Ignore if doesn't exist
  }

  async findAll(): Promise<WarehouseLocation[]> {
    const models = await this.prisma.warehouseLocationModel.findMany();
    return models.map(model => new WarehouseLocation(
      new LocationId(model.id),
      model.warehouseId,
      model.zone,
      model.aisle,
      model.rack,
      model.shelf,
      model.bin,
      model.maxWeightGrams,
      model.maxVolumeCubicMeters
    ));
  }
}
