import { CreatePurchaseOrder } from "../../../src/application/useCases/CreatePurchaseOrder";
import { InMemoryPurchaseOrderRepository } from "../../../src/infrastructure/database/InMemoryPurchaseOrderRepository";
import { PurchaseOrderStatus } from "../../../src/domain/procurement/enums/PurchaseOrderStatus";

describe("CreatePurchaseOrder Use Case", () => {
  let poRepository: InMemoryPurchaseOrderRepository;
  let useCase: CreatePurchaseOrder;

  beforeEach(() => {
    poRepository = new InMemoryPurchaseOrderRepository();
    useCase = new CreatePurchaseOrder(poRepository);
  });

  it("should create a purchase order successfully", async () => {
    const dto = {
      purchaseOrderNumber: "PO-100",
      vendorId: "vendor-1",
      tenantId: "tenant-1",
      locationId: "location-1",
      items: [
        { variantId: "variant-A", quantity: 10, unitCostCents: 1500 },
        { variantId: "variant-B", quantity: 5, unitCostCents: 2000 }
      ]
    };

    const po = await useCase.execute(dto);

    expect(po.purchaseOrderNumber).toBe("PO-100");
    expect(po.vendorId).toBe("vendor-1");
    expect(po.tenantId).toBe("tenant-1");
    expect(po.locationId).toBe("location-1");
    expect(po.status).toBe(PurchaseOrderStatus.Draft); // Assuming default status is Draft
    expect(po.items.length).toBe(2);

    expect(po.items[0].variantId).toBe("variant-A");
    expect(po.items[0].quantity).toBe(10);
    expect(po.items[0].unitCostCents).toBe(1500);

    const savedPo = await poRepository.findByNumber("PO-100");
    expect(savedPo).toBeDefined();
    expect(savedPo?.id).toBe(po.id);
  });

  it("should throw an error if purchase order number already exists", async () => {
    const dto = {
      purchaseOrderNumber: "PO-100",
      vendorId: "vendor-1",
      tenantId: "tenant-1",
      locationId: "location-1",
      items: []
    };

    await useCase.execute(dto);

    await expect(useCase.execute(dto)).rejects.toThrow(
      "Purchase order with number PO-100 already exists."
    );
  });
});
