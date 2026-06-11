import { ReceiveRMA } from "../../../src/application/useCases/ReceiveRMA";
import { CreateRMA } from "../../../src/application/useCases/CreateRMA";
import { InMemoryRMARepository } from "../../../src/infrastructure/database/InMemoryRMARepository";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryCostLayerRepository } from "../../../src/infrastructure/database/InMemoryCostLayerRepository";
import { InMemoryQuarantineRepository } from "../../../src/infrastructure/database/InMemoryQuarantineRepository";
import { InMemoryTenantConfigRepository } from "../../../src/infrastructure/database/InMemoryTenantConfigRepository";
import { InMemoryJournalRepository } from "../../../src/infrastructure/database/InMemoryJournalRepository";
import { TenantAccountingConfig } from "../../../src/domain/accounting/valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";
import { CostingMethod } from "../../../src/domain/accounting/enums/CostingMethod";
import { RMADisposition } from "../../../src/domain/returns/enums/RMADisposition";
import { QuarantineStatus } from "../../../src/domain/returns/enums/QuarantineStatus";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { DebitCredit } from "../../../src/domain/accounting/enums/DebitCredit";

describe("ReceiveRMA Use Case", () => {
  let rmaRepository: InMemoryRMARepository;
  let inventoryRepository: InMemoryInventoryRepository;
  let costLayerRepository: InMemoryCostLayerRepository;
  let quarantineRepository: InMemoryQuarantineRepository;
  let tenantConfigRepository: InMemoryTenantConfigRepository;
  let journalRepository: InMemoryJournalRepository;

  let createRmaUseCase: CreateRMA;
  let receiveRmaUseCase: ReceiveRMA;

  const tenantId = "TEN-1";
  const locationId = "loc-A";

  beforeEach(async () => {
    rmaRepository = new InMemoryRMARepository();
    inventoryRepository = new InMemoryInventoryRepository();
    costLayerRepository = new InMemoryCostLayerRepository();
    quarantineRepository = new InMemoryQuarantineRepository();
    tenantConfigRepository = new InMemoryTenantConfigRepository();
    journalRepository = new InMemoryJournalRepository();

    createRmaUseCase = new CreateRMA(rmaRepository);
    receiveRmaUseCase = new ReceiveRMA(
      rmaRepository,
      inventoryRepository,
      costLayerRepository,
      quarantineRepository,
      tenantConfigRepository,
      journalRepository
    );

    // Setup Accrual + FIFO config
    await tenantConfigRepository.save(
      tenantId,
      new TenantAccountingConfig(AccountingMethod.Accrual, CostingMethod.FIFO, "USD", "01-01")
    );
  });

  it("should receive returned stock, increment inventory, add cost layers, and post COGS reversal journals", async () => {
    // 1. Create and authorize RMA
    const rma = await createRmaUseCase.execute({
      rmaNumber: "RMA-100",
      tenantId,
      customerId: "CUST-1",
      locationId,
      items: [{ variantId: "VAR-A", quantity: 5, unitCostCents: 1000 }],
    });
    rma.authorize();
    await rmaRepository.save(rma);

    // 2. Receive stock
    await receiveRmaUseCase.execute({
      rmaId: rma.id,
      items: [{ variantId: "VAR-A", quantityReceived: 3, disposition: RMADisposition.Restock }],
    });

    // 3. Verify stock is incremented
    const invItem = await inventoryRepository.findBySku(SKU.create("VAR-A"), locationId);
    expect(invItem?.quantity.getValue()).toBe(3);

    // 4. Verify cost layer is added
    const activeLayers = await costLayerRepository.getActiveLayers("VAR-A");
    expect(activeLayers.length).toBe(1);
    expect(activeLayers[0].remainingQuantity).toBe(3);
    expect(activeLayers[0].unitCostCents).toBe(1000);

    // 5. Verify journal entries (Debit: Inventory Asset 1200, Credit: COGS 5000)
    const entries = await journalRepository.findAll(tenantId);
    expect(entries.length).toBe(1);
    expect(entries[0].lines.length).toBe(2);
    expect(entries[0].lines[0].account.code).toBe("1200"); // Inventory Asset
    expect(entries[0].lines[0].type).toBe(DebitCredit.Debit);
    expect(entries[0].lines[0].amountCents).toBe(3000);
    expect(entries[0].lines[1].account.code).toBe("5000"); // COGS
    expect(entries[0].lines[1].type).toBe(DebitCredit.Credit);
    expect(entries[0].lines[1].amountCents).toBe(3000);
  });

  it("should quarantine returned items when received with quarantine disposition", async () => {
    // 1. Create and authorize RMA
    const rma = await createRmaUseCase.execute({
      rmaNumber: "RMA-200",
      tenantId,
      customerId: "CUST-1",
      locationId,
      items: [{ variantId: "VAR-B", quantity: 5, unitCostCents: 1500 }],
    });
    rma.authorize();
    await rmaRepository.save(rma);

    // 2. Receive stock into quarantine
    await receiveRmaUseCase.execute({
      rmaId: rma.id,
      items: [{ variantId: "VAR-B", quantityReceived: 2, disposition: RMADisposition.Quarantine }],
    });

    // 3. Verify stock is incremented in quarantine location, not standard location
    const stdInvItem = await inventoryRepository.findBySku(SKU.create("VAR-B"), locationId);
    const qInvItem = await inventoryRepository.findBySku(SKU.create("VAR-B"), `${locationId}-quarantine`);
    expect(stdInvItem).toBeNull();
    expect(qInvItem?.quantity.getValue()).toBe(2);

    // 4. Verify QuarantineItem is created
    const qItems = await quarantineRepository.findAll();
    expect(qItems.length).toBe(1);
    expect(qItems[0].variantId).toBe("VAR-B");
    expect(qItems[0].quantity).toBe(2);
    expect(qItems[0].status).toBe(QuarantineStatus.Quarantined);
  });

  it("should immediately write off items received with scrap disposition", async () => {
    // 1. Create and authorize RMA
    const rma = await createRmaUseCase.execute({
      rmaNumber: "RMA-300",
      tenantId,
      customerId: "CUST-1",
      locationId,
      items: [{ variantId: "VAR-C", quantity: 5, unitCostCents: 2000 }],
    });
    rma.authorize();
    await rmaRepository.save(rma);

    // 2. Receive stock to scrap
    await receiveRmaUseCase.execute({
      rmaId: rma.id,
      items: [{ variantId: "VAR-C", quantityReceived: 2, disposition: RMADisposition.Scrap }],
    });

    // 3. Verify inventory is 0 (incremented then immediately decremented)
    const invItem = await inventoryRepository.findBySku(SKU.create("VAR-C"), locationId);
    expect(invItem?.quantity.getValue()).toBe(0);

    // 4. Verify two journal entries (1. Return receipt, 2. Write-off)
    const entries = await journalRepository.findAll(tenantId);
    expect(entries.length).toBe(2);

    // Entry 1: Return Receipt
    expect(entries[0].lines[0].account.code).toBe("1200");
    expect(entries[0].lines[1].account.code).toBe("5000");

    // Entry 2: Write-off
    expect(entries[1].lines[0].account.code).toBe("5300"); // Write-off expense
    expect(entries[1].lines[0].type).toBe(DebitCredit.Debit);
    expect(entries[1].lines[0].amountCents).toBe(4000);
    expect(entries[1].lines[1].account.code).toBe("1200"); // Inventory asset reduction
    expect(entries[1].lines[1].type).toBe(DebitCredit.Credit);
    expect(entries[1].lines[1].amountCents).toBe(4000);
  });
});
