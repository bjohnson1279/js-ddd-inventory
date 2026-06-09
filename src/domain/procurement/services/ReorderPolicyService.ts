import { IReorderPolicyRepository } from "../../repositories/IReorderPolicyRepository";
import { IPurchaseOrderRepository } from "../../repositories/IPurchaseOrderRepository";
import { CreatePurchaseOrder } from "../../../application/useCases/CreatePurchaseOrder";
import { DomainEventDispatcher } from "../../events/DomainEventDispatcher";
import { ReorderPointReachedEvent } from "../../events/ReorderPointReachedEvent";
import { PurchaseOrderStatus } from "../enums/PurchaseOrderStatus";
import { SKU } from "../../valueObjects/SKU";

export class ReorderPolicyService {
  constructor(
    private readonly reorderPolicyRepository: IReorderPolicyRepository,
    private readonly poRepository: IPurchaseOrderRepository
  ) {}

  public async checkPolicy(
    skuStr: string,
    locationId: string,
    currentQuantity: number,
    tenantId: string = "default-tenant"
  ): Promise<void> {
    const sku = SKU.create(skuStr);
    const policy = await this.reorderPolicyRepository.findBySkuAndLocation(sku, locationId);
    if (!policy) return;

    if (policy.shouldReorder(currentQuantity)) {
      // 1. Emit Domain Event
      const event = new ReorderPointReachedEvent(
        skuStr,
        locationId,
        currentQuantity,
        policy.reorderPoint,
        policy.reorderQuantity
      );
      await DomainEventDispatcher.dispatch([event]);

      // 2. Check if a draft/approved/sent purchase order already exists for this vendor/location and includes this sku
      const allPos = await this.poRepository.findAll();
      const alreadyOrdered = allPos.some((po) => {
        if (po.tenantId !== tenantId || po.locationId !== locationId) return false;
        if (
          po.status === PurchaseOrderStatus.Draft ||
          po.status === PurchaseOrderStatus.Approved ||
          po.status === PurchaseOrderStatus.Sent
        ) {
          return po.items.some(
            (item) => item.variantId === skuStr && item.receivedQuantity < item.quantity
          );
        }
        return false;
      });

      if (!alreadyOrdered) {
        // Automatically create a draft purchase order!
        const createPoUseCase = new CreatePurchaseOrder(this.poRepository);
        const poNumber = `AUTO-REORDER-${skuStr}-${Date.now().toString(36).toUpperCase()}`;
        await createPoUseCase.execute({
          purchaseOrderNumber: poNumber,
          vendorId: "AUTO-SYSTEM-VENDOR",
          tenantId,
          locationId,
          items: [
            {
              variantId: skuStr,
              quantity: policy.reorderQuantity,
              unitCostCents: 0, // In a real system, we'd look up the vendor agreement cost
            },
          ],
        });
      }
    }
  }
}
