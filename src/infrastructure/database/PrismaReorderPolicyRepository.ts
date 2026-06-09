import { IReorderPolicyRepository } from "../../domain/repositories/IReorderPolicyRepository";
import { ReorderPolicy } from "../../domain/procurement/aggregates/ReorderPolicy";
import { SKU } from "../../domain/valueObjects/SKU";
import { prisma } from "./prisma";

export class PrismaReorderPolicyRepository implements IReorderPolicyRepository {
  private prisma = prisma;

  private mapToDomain(record: any): ReorderPolicy {
    return new ReorderPolicy(
      record.id,
      SKU.create(record.sku),
      record.locationId,
      record.reorderPoint,
      record.reorderQuantity,
      record.safetyStock
    );
  }

  async findBySkuAndLocation(sku: SKU, locationId: string): Promise<ReorderPolicy | null> {
    const record = await this.prisma.reorderPolicyModel.findUnique({
      where: {
        sku_locationId: {
          sku: sku.getValue(),
          locationId
        }
      }
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async save(policy: ReorderPolicy): Promise<void> {
    await this.prisma.reorderPolicyModel.upsert({
      where: {
        sku_locationId: {
          sku: policy.sku.getValue(),
          locationId: policy.locationId
        }
      },
      update: {
        reorderPoint: policy.reorderPoint,
        reorderQuantity: policy.reorderQuantity,
        safetyStock: policy.safetyStock
      },
      create: {
        id: policy.id,
        sku: policy.sku.getValue(),
        locationId: policy.locationId,
        reorderPoint: policy.reorderPoint,
        reorderQuantity: policy.reorderQuantity,
        safetyStock: policy.safetyStock
      }
    });
  }

  async findAll(): Promise<ReorderPolicy[]> {
    const records = await this.prisma.reorderPolicyModel.findMany();
    return records.map(record => this.mapToDomain(record));
  }
}
