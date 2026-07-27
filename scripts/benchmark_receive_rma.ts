import { ReceiveRMA } from "../src/application/useCases/ReceiveRMA";
import { CreateRMA } from "../src/application/useCases/CreateRMA";
import { TenantAccountingConfig } from "../src/domain/accounting/valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../src/domain/accounting/enums/AccountingMethod";
import { CostingMethod } from "../src/domain/accounting/enums/CostingMethod";
import { RMADisposition } from "../src/domain/returns/enums/RMADisposition";
import { SerializedItem } from "../src/domain/serial/aggregates/SerializedItem";
import { SerialNumber } from "../src/domain/serial/valueObjects/SerialNumber";
import { SerializedItemStatus } from "../src/domain/serial/enums/SerializedItemStatus";
import { prisma } from "../src/infrastructure/database/prisma";
import { PrismaRMARepository } from "../src/infrastructure/database/PrismaRMARepository";
import { PrismaInventoryRepository } from "../src/infrastructure/database/PrismaInventoryRepository";
import { PrismaCostLayerRepository } from "../src/infrastructure/database/PrismaCostLayerRepository";
import { PrismaQuarantineRepository } from "../src/infrastructure/database/PrismaQuarantineRepository";
import { PrismaTenantConfigRepository } from "../src/infrastructure/database/PrismaTenantConfigRepository";
import { PrismaJournalRepository } from "../src/infrastructure/database/PrismaJournalRepository";
import { PrismaSerializedItemRepository } from "../src/infrastructure/database/PrismaSerializedItemRepository";

async function run() {
  const numItems = 50;
  console.log(`Setting up benchmark for ${numItems} serialized items...`);

  const rmaRepository = new PrismaRMARepository();
  const inventoryRepository = new PrismaInventoryRepository();
  const costLayerRepository = new PrismaCostLayerRepository();
  const quarantineRepository = new PrismaQuarantineRepository();
  const tenantConfigRepository = new PrismaTenantConfigRepository();
  const journalRepository = new PrismaJournalRepository();
  const serializedItemRepository = new PrismaSerializedItemRepository();

  const receiveRmaUseCase = new ReceiveRMA(
    rmaRepository,
    inventoryRepository,
    costLayerRepository,
    quarantineRepository,
    tenantConfigRepository,
    journalRepository,
    serializedItemRepository
  );

  const tenantId = "BENCH-TENANT";
  const locationId = "bench-loc";

  // Clean up
  await prisma.statusTransitionModel.deleteMany({});
  await prisma.serializedItemModel.deleteMany({});
  await prisma.rMAItemModel.deleteMany({});
  await prisma.rMAModel.deleteMany({});
  await prisma.tenantConfigModel.deleteMany({});

  await tenantConfigRepository.save(
    tenantId,
    new TenantAccountingConfig(AccountingMethod.Accrual, CostingMethod.FIFO, "USD", "01-01")
  );

  // Setup Serialized Items
  const serialNumbers: string[] = [];
  for (let i = 0; i < numItems; i++) {
    const sn = `SN-BENCH-${i}`;
    serialNumbers.push(sn);
    const item = new SerializedItem(
      `ID-${i}`,
      "VAR-BENCH",
      new SerialNumber(sn),
      tenantId,
      locationId,
      SerializedItemStatus.Sold,
      []
    );
    await serializedItemRepository.save(item);
  }

  const createRmaUseCase = new CreateRMA(rmaRepository);
  const rma = await createRmaUseCase.execute({
    rmaNumber: "RMA-BENCH-100",
    tenantId,
    customerId: "CUST-BENCH",
    locationId,
    items: [{ variantId: "VAR-BENCH", quantity: numItems, unitCostCents: 1000 }],
  });
  rma.authorize();
  await rmaRepository.save(rma);

  console.log("Running benchmark...");
  const start = Date.now();

  await receiveRmaUseCase.execute({
    rmaId: rma.id,
    items: [
      {
        variantId: "VAR-BENCH",
        quantityReceived: numItems,
        disposition: RMADisposition.Restock,
        serialNumbers,
      },
    ],
  });

  const end = Date.now();
  console.log(`Time taken: ${end - start} ms`);
}

run().catch(console.error).finally(() => process.exit(0));
