import { ReceivePurchaseOrder } from "../src/application/useCases/ReceivePurchaseOrder";
import { CreatePurchaseOrder } from "../src/application/useCases/CreatePurchaseOrder";
import { PrismaPurchaseOrderRepository } from "../src/infrastructure/database/PrismaPurchaseOrderRepository";
import { PrismaInventoryRepository } from "../src/infrastructure/database/PrismaInventoryRepository";
import { PrismaCostLayerRepository } from "../src/infrastructure/database/PrismaCostLayerRepository";
import { prisma } from "../src/infrastructure/database/prisma";
import { PurchaseOrderStatus } from "../src/domain/procurement/enums/PurchaseOrderStatus";

async function run() {
  const numItems = 500;
  console.log(`Setting up benchmark for PO with ${numItems} items...`);

  const poRepository = new PrismaPurchaseOrderRepository();
  const inventoryRepository = new PrismaInventoryRepository();
  // We'll wrap the costLayerRepository to NOT have saveMany so we hit the fallback path
  const realCostLayerRepo = new PrismaCostLayerRepository();
  const costLayerRepository = {
    getActiveLayers: realCostLayerRepo.getActiveLayers.bind(realCostLayerRepo),
    save: realCostLayerRepo.save.bind(realCostLayerRepo)
  };

  const receivePoUseCase = new ReceivePurchaseOrder(
    poRepository,
    inventoryRepository,
    costLayerRepository
  );

  const tenantId = "BENCH-TENANT-PO";
  const locationId = "bench-loc";
  const vendorId = "bench-vendor";

  // Clean up
  await prisma.inventoryCostLayerModel.deleteMany({});
  await prisma.inventoryModel.deleteMany({});
  await prisma.purchaseOrderItemModel.deleteMany({});
  await prisma.purchaseOrderModel.deleteMany({});

  const createPoUseCase = new CreatePurchaseOrder(poRepository);

  const items = Array.from({ length: numItems }).map((_, i) => ({
    variantId: `VAR-BENCH-${i}`,
    quantity: 10,
    unitCostCents: 1000
  }));

  const po = await createPoUseCase.execute({
    purchaseOrderNumber: "PO-BENCH-100",
    tenantId,
    locationId,
    vendorId,
    items
  });

  // Need to call methods to move status to Sent
  po.approve();
  po.send();
  await poRepository.save(po);

  console.log("Running benchmark...");
  // Now we execute in a transaction or normally.
  const start = Date.now();

  await receivePoUseCase.execute({
    purchaseOrderId: po.id,
    items: items.map(i => ({ variantId: i.variantId, quantityReceived: i.quantity }))
  });

  const end = Date.now();
  console.log(`Time taken: ${end - start} ms`);
}

run().catch(console.error).finally(() => process.exit(0));
