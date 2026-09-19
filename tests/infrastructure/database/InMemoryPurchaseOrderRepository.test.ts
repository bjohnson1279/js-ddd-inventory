import { InMemoryPurchaseOrderRepository } from "../../../src/infrastructure/database/InMemoryPurchaseOrderRepository";
import { PurchaseOrder } from "../../../src/domain/procurement/aggregates/PurchaseOrder";
import { PurchaseOrderItem } from "../../../src/domain/procurement/aggregates/PurchaseOrderItem";
import { PurchaseOrderStatus } from "../../../src/domain/procurement/enums/PurchaseOrderStatus";

describe("InMemoryPurchaseOrderRepository", () => {
  let repository: InMemoryPurchaseOrderRepository;

  beforeEach(() => {
    repository = new InMemoryPurchaseOrderRepository();
  });

  it("should find received purchase orders by tenant, variant and location", async () => {
    const po = new PurchaseOrder(
      "po-received-1",
      "PO-REC-1",
      "vendor-1",
      "tenant-1",
      "loc-1",
      PurchaseOrderStatus.Received,
      [new PurchaseOrderItem("item-1", "var-1", 10, 100, 10)]
    );
    await repository.save(po);

    const found = await repository.findReceivedByTenantAndVariant("tenant-1", "var-1", "loc-1");
    expect(found).toHaveLength(1);
    expect(found[0].purchaseOrderNumber).toBe("PO-REC-1");

    const notFound = await repository.findReceivedByTenantAndVariant("tenant-1", "var-1", "loc-2");
    expect(notFound).toHaveLength(0);
  });
});
