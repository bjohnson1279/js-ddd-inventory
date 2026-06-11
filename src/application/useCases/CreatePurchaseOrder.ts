import { IPurchaseOrderRepository } from "../../domain/repositories/IPurchaseOrderRepository";
import { PurchaseOrder } from "../../domain/procurement/aggregates/PurchaseOrder";
import { PurchaseOrderItem } from "../../domain/procurement/aggregates/PurchaseOrderItem";

export interface CreatePurchaseOrderItemDTO {
  variantId: string;
  quantity: number;
  unitCostCents: number;
}

export interface CreatePurchaseOrderDTO {
  purchaseOrderNumber: string;
  vendorId: string;
  tenantId: string;
  locationId: string;
  items: CreatePurchaseOrderItemDTO[];
}

export class CreatePurchaseOrder {
  constructor(private readonly poRepository: IPurchaseOrderRepository) {}

  async execute(dto: CreatePurchaseOrderDTO): Promise<PurchaseOrder> {
    const existing = await this.poRepository.findByNumber(dto.purchaseOrderNumber);
    if (existing) {
      throw new Error(`Purchase order with number ${dto.purchaseOrderNumber} already exists.`);
    }

    const id = crypto.randomUUID();
    const items = dto.items.map(item => 
      new PurchaseOrderItem(
        crypto.randomUUID(),
        item.variantId,
        item.quantity,
        item.unitCostCents
      )
    );

    const po = new PurchaseOrder(
      id,
      dto.purchaseOrderNumber,
      dto.vendorId,
      dto.tenantId,
      dto.locationId,
      undefined,
      items
    );

    await this.poRepository.save(po);
    return po;
  }
}
