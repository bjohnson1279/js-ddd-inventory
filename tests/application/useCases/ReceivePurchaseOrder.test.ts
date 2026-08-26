import { ReceivePurchaseOrder } from "../../../src/application/useCases/ReceivePurchaseOrder";
import { InMemoryPurchaseOrderRepository } from "../../../src/infrastructure/database/InMemoryPurchaseOrderRepository";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryCostLayerRepository } from "../../../src/infrastructure/database/InMemoryCostLayerRepository";
import { PurchaseOrder } from "../../../src/domain/procurement/aggregates/PurchaseOrder";
import { PurchaseOrderItem } from "../../../src/domain/procurement/aggregates/PurchaseOrderItem";
import { PurchaseOrderStatus } from "../../../src/domain/procurement/enums/PurchaseOrderStatus";
import { SKU } from "../../../src/domain/valueObjects/SKU";

describe("ReceivePurchaseOrder Use Case", () => {
  let poRepository: InMemoryPurchaseOrderRepository;
  let inventoryRepository: InMemoryInventoryRepository;
  let costLayerRepository: InMemoryCostLayerRepository;
  let useCase: ReceivePurchaseOrder;

  beforeEach(() => {
    poRepository = new InMemoryPurchaseOrderRepository();
    inventoryRepository = new InMemoryInventoryRepository();
    costLayerRepository = new InMemoryCostLayerRepository();
    useCase = new ReceivePurchaseOrder(poRepository, inventoryRepository, costLayerRepository);
  });

  it("should receive items, update stock, and create cost layers", async () => {
    const itemA = new PurchaseOrderItem("item-1", "variant-A", 10, 1500);
    const itemB = new PurchaseOrderItem("item-2", "variant-B", 5, 2000);
    const po = new PurchaseOrder("po-1", "PO-100", "vendor-1", "tenant-1", "location-1", PurchaseOrderStatus.Sent, [itemA, itemB]);

    await poRepository.save(po);

    await useCase.execute({
      purchaseOrderId: "po-1",
      items: [
        { variantId: "variant-A", quantityReceived: 4 },
        { variantId: "variant-B", quantityReceived: 5 },
      ]
    });

    const updatedPo = await poRepository.findById("po-1");
    expect(updatedPo?.status).toBe(PurchaseOrderStatus.PartiallyReceived);
    expect(updatedPo?.items.find(i => i.variantId === "variant-A")?.receivedQuantity).toBe(4);
    expect(updatedPo?.items.find(i => i.variantId === "variant-B")?.receivedQuantity).toBe(5);

    // Verify stock levels
    const stockA = await inventoryRepository.findBySku(SKU.create("variant-A"), "location-1");
    const stockB = await inventoryRepository.findBySku(SKU.create("variant-B"), "location-1");
    expect(stockA?.quantity.getValue()).toBe(4);
    expect(stockB?.quantity.getValue()).toBe(5);

    // Verify cost layers
    const layersA = await costLayerRepository.getActiveLayers("variant-A");
    const layersB = await costLayerRepository.getActiveLayers("variant-B");
    expect(layersA.length).toBe(1);
    expect(layersA[0].originalQuantity).toBe(4);
    expect(layersA[0].unitCostCents).toBe(1500);
    expect(layersA[0].locationId).toBe("location-1");

    expect(layersB.length).toBe(1);
    expect(layersB[0].originalQuantity).toBe(5);
    expect(layersB[0].unitCostCents).toBe(2000);
    expect(layersB[0].locationId).toBe("location-1");
  });
});
