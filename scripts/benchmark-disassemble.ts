import { prisma } from "../src/infrastructure/database/prisma";
import { PrismaInventoryRepository } from "../src/infrastructure/database/PrismaInventoryRepository";
import { PrismaCostLayerRepository } from "../src/infrastructure/database/PrismaCostLayerRepository";
import { PrismaTenantConfigRepository } from "../src/infrastructure/database/PrismaTenantConfigRepository";
import { PrismaJournalRepository } from "../src/infrastructure/database/PrismaJournalRepository";
import { DisassembleKit, DisassembleKitDTO } from "../src/application/useCases/DisassembleKit";
import crypto from "crypto";

async function runBenchmark() {
  const inventoryRepo = new PrismaInventoryRepository();
  const costLayerRepo = new PrismaCostLayerRepository();
  const tenantConfigRepo = new PrismaTenantConfigRepository();
  const journalRepo = new PrismaJournalRepository();

  // Make sure saveMany is NOT present for baseline test by overriding it
  const originalSaveMany = (costLayerRepo as any).saveMany;
  (costLayerRepo as any).saveMany = undefined;

  const disassembler = new DisassembleKit(
    inventoryRepo,
    costLayerRepo,
    tenantConfigRepo,
    journalRepo
  );

  const tenantId = "bench-tenant";
  const locationId = "bench-loc";
  const kitSku = "BENCH-KIT";

  // setup data
  await prisma.kitComponentModel.deleteMany();
  await prisma.kitModel.deleteMany();
  await prisma.inventoryCostLayerModel.deleteMany();
  await prisma.inventoryModel.deleteMany();

  await prisma.kitModel.create({
    data: {
      id: crypto.randomUUID(),
      sku: kitSku,
      name: "Bench Kit",
      components: {
        create: Array.from({ length: 50 }).map((_, i) => ({
          id: crypto.randomUUID(),
          variantId: `COMP-${i}`,
          quantity: 2
        }))
      }
    }
  });

  await prisma.inventoryModel.create({
    data: {
      id: "kit-inv",
      sku: kitSku,
      locationId,
      quantity: 1000,
      allocated: 0,
      inTransit: 0,
      version: 1
    }
  });

  await prisma.inventoryCostLayerModel.create({
    data: {
      id: "kit-layer",
      variantId: kitSku,
      tenantId,
      originalQuantity: 1000,
      remainingQuantity: 1000,
      unitCostCents: 1000,
      receivedAt: new Date(),
      locationId,
      purchaseOrderId: "setup"
    }
  });

  const dto: DisassembleKitDTO = {
    tenantId,
    locationId,
    kitSku,
    quantity: 1, // 1 kit disassembles into 50 components
    actorId: "tester",
    referenceId: "bench"
  };

  const start = Date.now();
  await disassembler.execute(dto);
  const end = Date.now();
  console.log(`DisassembleKit execution time without saveMany (Promise.all): ${end - start}ms`);

  // reset inventory and cost layers for second run
  await prisma.inventoryModel.deleteMany();
  await prisma.inventoryCostLayerModel.deleteMany({ where: { tenantId } });
  await prisma.inventoryModel.create({
    data: {
      id: "kit-inv-2",
      sku: kitSku,
      locationId,
      quantity: 1000,
      allocated: 0,
      inTransit: 0,
      version: 1
    }
  });
  await prisma.inventoryCostLayerModel.create({
    data: {
      id: "kit-layer-2",
      variantId: kitSku,
      tenantId,
      originalQuantity: 1000,
      remainingQuantity: 1000,
      unitCostCents: 1000,
      receivedAt: new Date(),
      locationId,
      purchaseOrderId: "setup"
    }
  });

  // restore saveMany
  (costLayerRepo as any).saveMany = originalSaveMany;

  const start2 = Date.now();
  await disassembler.execute({ ...dto, referenceId: "bench2" });
  const end2 = Date.now();
  console.log(`DisassembleKit execution time with saveMany: ${end2 - start2}ms`);

  await prisma.$disconnect();
}

runBenchmark().catch(console.error);
