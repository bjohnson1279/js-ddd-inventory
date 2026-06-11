import { IInventoryAuditRepository } from "../../domain/repositories/IInventoryAuditRepository";
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { InventoryAudit } from "../../domain/procurement/aggregates/InventoryAudit";
import { InventoryAuditItem } from "../../domain/procurement/aggregates/InventoryAuditItem";
import { SKU } from "../../domain/valueObjects/SKU";

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

    for (const variantId of variants) {
      const sku = SKU.create(variantId);
      const inventoryItem = await this.inventoryRepository.findBySku(sku, dto.locationId);
      const expectedQuantity = inventoryItem ? inventoryItem.quantity.getValue() : 0;

      const itemId = Math.random().toString(36).substring(2, 11);
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

    const auditId = Math.random().toString(36).substring(2, 11);
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
