import { ReorderPolicyService } from "../../../src/domain/procurement/services/ReorderPolicyService";
import { InMemoryReorderPolicyRepository } from "../../../src/infrastructure/database/InMemoryReorderPolicyRepository";
import { InMemoryPurchaseOrderRepository } from "../../../src/infrastructure/database/InMemoryPurchaseOrderRepository";
import { ReorderPolicy } from "../../../src/domain/procurement/aggregates/ReorderPolicy";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { DomainEventDispatcher } from "../../../src/domain/events/DomainEventDispatcher";
import { PurchaseOrderStatus } from "../../../src/domain/procurement/enums/PurchaseOrderStatus";

describe("ReorderPolicyService", () => {
  let reorderPolicyRepo: InMemoryReorderPolicyRepository;
  let poRepo: InMemoryPurchaseOrderRepository;
  let service: ReorderPolicyService;
  let dispatchSpy: jest.SpyInstance;

  beforeEach(() => {
    reorderPolicyRepo = new InMemoryReorderPolicyRepository();
    poRepo = new InMemoryPurchaseOrderRepository();
    service = new ReorderPolicyService(reorderPolicyRepo, poRepo);
    dispatchSpy = jest.spyOn(DomainEventDispatcher, "dispatch").mockResolvedValue();
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  it("should do nothing if inventory quantity is above reorder point", async () => {
    const policy = new ReorderPolicy("p-1", SKU.create("SKU-1"), "warehouse-1", 5, 20, 2);
    await reorderPolicyRepo.save(policy);

    await service.checkPolicy("SKU-1", "warehouse-1", 10, "tenant-1");

    expect(dispatchSpy).not.toHaveBeenCalled();
    const pos = await poRepo.findAll();
    expect(pos.length).toBe(0);
  });

  it("should trigger event and create a draft purchase order if inventory falls below reorder point and no pending PO exists", async () => {
    const policy = new ReorderPolicy("p-1", SKU.create("SKU-1"), "warehouse-1", 5, 20, 2);
    await reorderPolicyRepo.save(policy);

    await service.checkPolicy("SKU-1", "warehouse-1", 4, "tenant-1");

    // Verify event is dispatched
    expect(dispatchSpy).toHaveBeenCalled();
    const dispatchedEvents = dispatchSpy.mock.calls[0][0];
    expect(dispatchedEvents.length).toBe(1);
    expect(dispatchedEvents[0].eventName).toBe("ReorderPointReachedEvent");
    expect(dispatchedEvents[0].sku).toBe("SKU-1");

    // Verify draft PO is created
    const pos = await poRepo.findAll();
    expect(pos.length).toBe(1);
    expect(pos[0].purchaseOrderNumber).toContain("AUTO-REORDER-SKU-1");
    expect(pos[0].status).toBe(PurchaseOrderStatus.Draft);
    expect(pos[0].items.length).toBe(1);
    expect(pos[0].items[0].variantId).toBe("SKU-1");
    expect(pos[0].items[0].quantity).toBe(20);
  });

  it("should trigger event but NOT create duplicate PO if a pending PO already exists for the SKU and location", async () => {
    const policy = new ReorderPolicy("p-1", SKU.create("SKU-1"), "warehouse-1", 5, 20, 2);
    await reorderPolicyRepo.save(policy);

    // Seed existing sent PO
    const poUseCase = new (require("../../../src/application/useCases/CreatePurchaseOrder").CreatePurchaseOrder)(poRepo);
    const po = await poUseCase.execute({
      purchaseOrderNumber: "PO-EXISTING",
      vendorId: "vendor-1",
      tenantId: "tenant-1",
      locationId: "warehouse-1",
      items: [{ variantId: "SKU-1", quantity: 50, unitCostCents: 1000 }]
    });
    po.approve();
    po.send();
    await poRepo.save(po);

    await service.checkPolicy("SKU-1", "warehouse-1", 4, "tenant-1");

    // Verify event is dispatched
    expect(dispatchSpy).toHaveBeenCalled();

    // Verify no new PO is created (still only 1 PO)
    const pos = await poRepo.findAll();
    expect(pos.length).toBe(1);
  });
});
