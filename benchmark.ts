import { InventoryService } from "./src/domain/services/InventoryService";
import { PrismaInventoryRepository } from "./src/infrastructure/database/PrismaInventoryRepository";
import { Kit } from "./src/domain/kit/aggregates/Kit";
import { SKU } from "./src/domain/valueObjects/SKU";
import { prisma } from "./src/infrastructure/database/prisma";

async function run() {
  const repo = new PrismaInventoryRepository();
  const service = new InventoryService(repo);

  // Setup data
  await prisma.inventoryModel.deleteMany({});

  const kit = new Kit("kit-1", SKU.create("kit-sku-1"), "Kit 1");

  for (let i = 0; i < 50; i++) {
    const sku = `SKU-BENCH-${i}`;
    kit.addComponent(sku, 1);
    await prisma.inventoryModel.create({
      data: {
        id: `ID-${i}`,
        sku: sku,
        quantity: 1000,
      }
    });
  }

  const start = Date.now();
  for (let i = 0; i < 10; i++) {
    await service.decrementForKitSale(kit, 1, `sale-${i}`, "actor");
  }
  const end = Date.now();

  console.log(`Baseline Time taken: ${end - start} ms`);
  process.exit(0);
}

run().catch(console.error);
