import { PrismaInventoryRepository } from "../src/infrastructure/database/PrismaInventoryRepository";
import { InventoryItem } from "../src/domain/aggregates/InventoryItem";
import { SKU } from "../src/domain/valueObjects/SKU";
import { Quantity } from "../src/domain/valueObjects/Quantity";
import { prisma } from "../src/infrastructure/database/prisma";
import crypto from "crypto";
import { tenantLocalStorage } from "../src/infrastructure/database/tenantContext";

async function runBenchmark() {
  console.log("Setting up benchmark...");

  // Clear tables
  await prisma.inventoryModel.deleteMany({});
  await prisma.complianceLedgerModel.deleteMany({});

  const repo = new PrismaInventoryRepository(undefined);

  const numItems = 200;
  const items: InventoryItem[] = [];

  for (let i = 0; i < numItems; i++) {
    items.push(
      InventoryItem.create(
        crypto.randomUUID(),
        SKU.create(`SKU-${i}`),
        "LOC-1",
        Quantity.create(10),
        Quantity.create(0),
        Quantity.create(0),
        1
      )
    );
  }

  console.log(`Starting benchmark for saveMany with ${numItems} items...`);

  await new Promise<void>((resolve) => {
    tenantLocalStorage.run("tenant-bench", async () => {
      const start = process.hrtime.bigint();

      await repo.saveMany(items);

      const end = process.hrtime.bigint();
      const diffInMs = Number(end - start) / 1000000;

      console.log(`Benchmark completed in ${diffInMs.toFixed(2)} ms.`);

      const ledgerCount = await prisma.complianceLedgerModel.count();
      console.log(`Ledger entries created: ${ledgerCount}`);

      resolve();
    });
  });
}

runBenchmark().catch(console.error).finally(() => prisma.$disconnect());
