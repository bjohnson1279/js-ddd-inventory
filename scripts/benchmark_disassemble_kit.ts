import { prisma } from "../src/infrastructure/database/prisma";
import { PrismaCostLayerRepository } from "../src/infrastructure/database/PrismaCostLayerRepository";
import { PrismaInventoryRepository } from "../src/infrastructure/database/PrismaInventoryRepository";
import { DisassembleKit } from "../src/application/useCases/DisassembleKit";
import { SKU } from "../src/domain/valueObjects/SKU";
import { Quantity } from "../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../src/domain/aggregates/InventoryItem";
import { InventoryCostLayer } from "../src/domain/accounting/entities/InventoryCostLayer";
import crypto from "crypto";

async function run() {
  await prisma.$connect();

  // Clean up
  await prisma.inventoryCostLayerModel.deleteMany({});
  await prisma.inventoryModel.deleteMany({});
  await prisma.kitModel.deleteMany({});
  await prisma.kitComponentModel.deleteMany({});

  const tenantId = "tenant-1";
  const locationId = "loc-1";
  const kitSku = "KIT-001";

  // 1. Create a kit with many components (e.g., 50 components)
  await prisma.kitModel.create({
    data: {
      id: crypto.randomUUID(),
      sku: kitSku,
      name: "Big Kit",
      components: {
        create: Array.from({ length: 50 }).map((_, i) => ({
          id: crypto.randomUUID(),
          variantId: `COMP-${i}`,
          quantity: 2,
        }))
      }
    }
  });

  // 2. Setup inventory and cost layers for the kit
  const invRepo = new PrismaInventoryRepository();
  const clRepo = new PrismaCostLayerRepository();

  const kitInvItem = InventoryItem.create(
    crypto.randomUUID(),
    SKU.create(kitSku),
    locationId,
    Quantity.create(100)
  );
  await invRepo.save(kitInvItem);

  await clRepo.save(new InventoryCostLayer(
    crypto.randomUUID(),
    kitSku,
    tenantId,
    100,
    5000,
    new Date(),
    "REF-1",
    locationId
  ));

  // Create active cost layers for components (to simulate existing data)
  const layersToCreate: InventoryCostLayer[] = [];
  for (let i = 0; i < 50; i++) {
    for (let j = 0; j < 5; j++) {
      layersToCreate.push(new InventoryCostLayer(
        crypto.randomUUID(),
        `COMP-${i}`,
        tenantId,
        100,
        100 * (j + 1), // variable cost
        new Date(Date.now() - j * 100000),
        "REF-2",
        locationId
      ));
    }
  }
  await clRepo.saveMany(layersToCreate);

  // Initialize use case
  // We need mock tenant config & journal repository
  const tenantConfigRepo = {
    findByTenantId: async () => null,
    save: async () => {}
  };
  const journalRepo = {
    save: async () => {}
  };

  const useCase = new DisassembleKit(
    invRepo,
    clRepo,
    tenantConfigRepo as any,
    journalRepo as any
  );

  console.log("Warming up...");
  await useCase.execute({
    tenantId,
    locationId,
    kitSku,
    quantity: 1,
    actorId: "actor-1",
    referenceId: "REF-W"
  });

  console.log("Running benchmark...");
  const iterations = 5;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    await useCase.execute({
      tenantId,
      locationId,
      kitSku,
      quantity: 1,
      actorId: "actor-1",
      referenceId: `REF-${i}`
    });
  }

  const end = performance.now();
  console.log(`Average time per execution: ${((end - start) / iterations).toFixed(2)} ms`);

  // Clean up
  await prisma.inventoryCostLayerModel.deleteMany({});
  await prisma.inventoryModel.deleteMany({});
  await prisma.kitModel.deleteMany({});
  await prisma.kitComponentModel.deleteMany({});
}

run().catch(console.error);
