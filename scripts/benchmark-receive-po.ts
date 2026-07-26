import { ReceivePurchaseOrder } from "../src/application/useCases/ReceivePurchaseOrder";
import { InMemoryPurchaseOrderRepository } from "../src/infrastructure/database/InMemoryPurchaseOrderRepository";
import { InMemoryInventoryRepository } from "../src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryCostLayerRepository } from "../src/infrastructure/database/InMemoryCostLayerRepository";
import { PurchaseOrder } from "../src/domain/procurement/aggregates/PurchaseOrder";
import { PurchaseOrderItem } from "../src/domain/procurement/aggregates/PurchaseOrderItem";
import { PurchaseOrderStatus } from "../src/domain/procurement/enums/PurchaseOrderStatus";
import { SKU } from "../src/domain/valueObjects/SKU";
import { InventoryItem } from "../src/domain/aggregates/InventoryItem";

async function runBenchmark() {
  const poRepository = new InMemoryPurchaseOrderRepository();
  const inventoryRepository = new InMemoryInventoryRepository();
  const costLayerRepository = new InMemoryCostLayerRepository();

  let findBySkuCalls = 0;
  let saveCalls = 0;

  const originalFindBySku = inventoryRepository.findBySku.bind(inventoryRepository);
  inventoryRepository.findBySku = async (sku: SKU, locationId?: string) => {
      findBySkuCalls++;
      // Simulate real db latency
      await new Promise(resolve => setTimeout(resolve, 2));
      return originalFindBySku(sku, locationId);
  };

  const originalSave = inventoryRepository.save.bind(inventoryRepository);
  inventoryRepository.save = async (item: InventoryItem) => {
      saveCalls++;
      await new Promise(resolve => setTimeout(resolve, 2));
      return originalSave(item);
  };

  const useCase = new ReceivePurchaseOrder(poRepository, inventoryRepository, costLayerRepository);

  const numItems = 50;
  const items: PurchaseOrderItem[] = [];
  const receiveDtoItems: any[] = [];

  for (let i = 0; i < numItems; i++) {
    items.push(new PurchaseOrderItem(`item-${i}`, `variant-${i}`, 10, 1500));
    receiveDtoItems.push({ variantId: `variant-${i}`, quantityReceived: 10 });
  }

  const po = new PurchaseOrder("po-benchmark", "PO-BENCH", "vendor-1", "tenant-1", "location-1", PurchaseOrderStatus.Sent, items);
  await poRepository.save(po);

  const start = Date.now();
  await useCase.execute({
    purchaseOrderId: "po-benchmark",
    items: receiveDtoItems
  });
  const end = Date.now();

  console.log(`Execution Time: ${end - start}ms`);
  console.log(`findBySku calls: ${findBySkuCalls}`);
  console.log(`save calls: ${saveCalls}`);
}

runBenchmark().catch(console.error);
