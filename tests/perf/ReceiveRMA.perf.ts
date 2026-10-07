import { ReceiveRMA } from "../../src/application/useCases/ReceiveRMA";
import { CreateRMA } from "../../src/application/useCases/CreateRMA";
import { InMemoryRMARepository } from "../../src/infrastructure/database/InMemoryRMARepository";
import { InMemoryInventoryRepository } from "../../src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryCostLayerRepository } from "../../src/infrastructure/database/InMemoryCostLayerRepository";
import { InMemoryQuarantineRepository } from "../../src/infrastructure/database/InMemoryQuarantineRepository";
import { InMemoryTenantConfigRepository } from "../../src/infrastructure/database/InMemoryTenantConfigRepository";
import { InMemoryJournalRepository } from "../../src/infrastructure/database/InMemoryJournalRepository";
import { TenantAccountingConfig } from "../../src/domain/accounting/valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../../src/domain/accounting/enums/AccountingMethod";
import { CostingMethod } from "../../src/domain/accounting/enums/CostingMethod";
import { RMADisposition } from "../../src/domain/returns/enums/RMADisposition";
import { SKU } from "../../src/domain/valueObjects/SKU";

async function runBenchmark() {
  const tenantId = "TEN-PERF";
  const locationId = "LOC-PERF";

  const tenantConfigRepo = new InMemoryTenantConfigRepository();
  await tenantConfigRepo.save(
    tenantId,
    new TenantAccountingConfig(AccountingMethod.Accrual, CostingMethod.FIFO, "USD", "01-01")
  );

  const numItems = 200;
  const items = [];
  for (let i = 0; i < numItems; i++) {
    items.push({
      variantId: `VAR-NEW-${i}`,
      quantity: 1,
      unitCostCents: 500,
    });
  }

  const rmaRepo = new InMemoryRMARepository();
  const createRmaUseCase = new CreateRMA(rmaRepo);
  const rma = await createRmaUseCase.execute({
    rmaNumber: "RMA-PERF-1",
    tenantId,
    customerId: "CUST-PERF",
    locationId,
    items,
  });
  rma.authorize();
  await rmaRepo.save(rma);

  let singleQueryCount = 0;
  let bulkQueryCount = 0;

  const invRepo = new InMemoryInventoryRepository();
  const origFindBySku = invRepo.findBySku.bind(invRepo);
  invRepo.findBySku = async (sku: SKU, loc?: string) => {
    singleQueryCount++;
    // Simulate I/O latency
    await new Promise((res) => setTimeout(res, 0.1));
    return origFindBySku(sku, loc);
  };

  const origFindBySkus = invRepo.findBySkus.bind(invRepo);
  invRepo.findBySkus = async (skus: SKU[], loc?: string) => {
    bulkQueryCount++;
    await new Promise((res) => setTimeout(res, 0.1));
    return origFindBySkus(skus, loc);
  };

  const costLayerRepo = new InMemoryCostLayerRepository();
  const quarantineRepo = new InMemoryQuarantineRepository();
  const journalRepo = new InMemoryJournalRepository();

  const receiveRma = new ReceiveRMA(
    rmaRepo,
    invRepo,
    costLayerRepo,
    quarantineRepo,
    tenantConfigRepo,
    journalRepo
  );

  const receiveItems = items.map((it) => ({
    variantId: it.variantId,
    quantityReceived: 1,
    disposition: RMADisposition.Restock,
  }));

  const start = performance.now();
  await receiveRma.execute({
    rmaId: rma.id,
    items: receiveItems,
  });
  const duration = performance.now() - start;

  console.log(`Execution time for receiving ${numItems} missing items: ${duration.toFixed(2)}ms`);
  console.log(`Bulk findBySkus calls: ${bulkQueryCount}`);
  console.log(`Single findBySku calls: ${singleQueryCount}`);
}

runBenchmark().catch(console.error);
