import { IInventoryAuditRepository } from "../../domain/repositories/IInventoryAuditRepository";
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { InventoryAudit } from "../../domain/procurement/aggregates/InventoryAudit";
import { InventoryAuditItem } from "../../domain/procurement/aggregates/InventoryAuditItem";
import { SKU } from "../../domain/valueObjects/SKU";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";

export interface CreateInventoryAuditDTO {
  auditNumber: string;
  tenantId: string;
  locationId: string;
  variantIds?: string[];
}

export class CreateInventoryAudit {
  constructor(
    private readonly auditRepository: IInventoryAuditRepository,
    private readonly inventoryRepository: IInventoryRepository
  ) {}

  async execute(dto: CreateInventoryAuditDTO): Promise<InventoryAudit> {
    const existing = await this.auditRepository.findByNumber(dto.auditNumber);
    if (existing) {
      throw new Error(`Inventory audit with number ${dto.auditNumber} already exists.`);
    }

    const auditItems: InventoryAuditItem[] = [];
    let variants = dto.variantIds;

    if (!variants || variants.length === 0) {
      // If no variants specified, snapshot all variants currently in inventory at this location
      const items = await this.inventoryRepository.findAllByLocation(dto.locationId);
      variants = items.map((item) => item.sku.getValue());
    }

    const skus = variants.map(v => SKU.create(v));
    let inventoryItems: InventoryItem[] = [];

    if (this.inventoryRepository.findBySkus) {
      inventoryItems = await this.inventoryRepository.findBySkus(skus, dto.locationId);
    } else {
      const fetchPromises = skus.map(async (sku) => {
        const item = await this.inventoryRepository.findBySku(sku, dto.locationId);
        return item;
      });
      const results = await Promise.all(fetchPromises);
      inventoryItems = results.filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined);
    }

    const itemsBySku = new Map(inventoryItems.map(item => [item.sku.getValue(), item]));

    for (const variantId of variants) {
      const inventoryItem = itemsBySku.get(variantId);
      const expectedQuantity = inventoryItem ? inventoryItem.quantity.getValue() : 0;

      const itemId = crypto.randomUUID();
      auditItems.push(
        new InventoryAuditItem(
          itemId,
          variantId,
          expectedQuantity,
          null,
          false
        )
      );
    }

    const auditId = crypto.randomUUID();
    const audit = new InventoryAudit(
      auditId,
      dto.auditNumber,
      dto.tenantId,
      dto.locationId,
      undefined,
      auditItems
    );

    await this.auditRepository.save(audit);
    return audit;
  }
}
