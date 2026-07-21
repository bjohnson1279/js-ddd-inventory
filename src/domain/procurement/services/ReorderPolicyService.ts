import { Logger } from "../../../infrastructure/logging/logger";
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

  public async evaluatePolicies(
    tenantId: string,
    forecaster: any,
    inventoryRepo: any,
    windowDays: number = 30
  ): Promise<{ sku: string; locationId: string; reorderPoint: number; triggered: boolean; reason?: string }[]> {
    const policies = await this.reorderPolicyRepository.findAll();
    const results: any[] = [];

    for (const policy of policies) {
      let rop = policy.reorderPoint;
      if (policy.dynamicRopEnabled) {
        try {
          const newRop = await forecaster.forecastReorderPoint(
            policy.sku.getValue(),
            policy.locationId,
            5, // default leadTimeDays = 5
            policy.safetyStock,
            windowDays,
            tenantId
          );
          policy.updateReorderPoint(newRop);
          await this.reorderPolicyRepository.save(policy);
          rop = newRop;
        } catch (error) {
          Logger.error({ context: "ReorderPolicyService", sku: policy.sku.getValue(), message: "Error forecasting ROP for SKU" }, error);
        }
      }

      const skuStr = policy.sku.getValue();
      const inventoryItem = await inventoryRepo.findBySku(policy.sku, policy.locationId);
      const currentQty = inventoryItem ? inventoryItem.quantity.getValue() : 0;

      let triggered = false;
      let reason = "";

      if (policy.shouldReorder(currentQty)) {
        const allPos = await this.poRepository.findAll();
        const alreadyOrdered = allPos.some((po) => {
          if (po.tenantId !== tenantId || po.locationId !== policy.locationId) return false;
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
          const createPoUseCase = new CreatePurchaseOrder(this.poRepository);
          const poNumber = `AUTO-REORDER-${skuStr}-${Date.now().toString(36).toUpperCase()}`;
          await createPoUseCase.execute({
            purchaseOrderNumber: poNumber,
            vendorId: "AUTO-SYSTEM-VENDOR",
            tenantId,
            locationId: policy.locationId,
            items: [
              {
                variantId: skuStr,
                quantity: policy.reorderQuantity,
                unitCostCents: 0,
              },
            ],
          });
          triggered = true;
        } else {
          reason = "Open purchase order already exists to prevent duplicate ordering";
        }
      }

      results.push({
        sku: skuStr,
        locationId: policy.locationId,
        reorderPoint: rop,
        triggered,
        reason
      });
    }

    return results;
  }

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
