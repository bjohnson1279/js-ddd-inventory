import { ReceiveRMA, ReceiveRMADTO } from '../src/application/useCases/ReceiveRMA';
import { IInventoryRepository } from '../src/domain/repositories/IInventoryRepository';
import { ICostLayerRepository } from '../src/domain/repositories/ICostLayerRepository';
import { IQuarantineRepository } from '../src/domain/repositories/IQuarantineRepository';
import { ITenantConfigRepository } from '../src/domain/repositories/ITenantConfigRepository';
import { IJournalRepository } from '../src/domain/repositories/IJournalRepository';
import { ISerializedItemRepository } from '../src/domain/repositories/ISerializedItemRepository';
import { IRMARepository } from '../src/domain/repositories/IRMARepository';
import { RMADisposition } from '../src/domain/returns/enums/RMADisposition';
import { AccountingMethod } from '../src/domain/accounting/enums/AccountingMethod';
import { SerialNumber } from '../src/domain/serial/valueObjects/SerialNumber';
import { SerializedItem } from '../src/domain/serial/aggregates/SerializedItem';
import { SerializedItemStatus } from '../src/domain/serial/enums/SerializedItemStatus';

async function runBenchmark() {
  console.log('Setting up mock repositories for benchmark...');

  const rmaId = 'test-rma-id';
  const tenantId = 'test-tenant';
  const locationId = 'test-loc';
  const variantId = 'test-variant';

  // Create 100 items for the RMA
  const numItems = 100;

  const mockRMA: any = {
    id: rmaId,
    tenantId: tenantId,
    rmaNumber: 'RMA-001',
    locationId: locationId,
    items: [{ variantId, unitCostCents: 1000 }],
    receiveItem: () => {},
  };

  const mockTenantConfig: any = {
    tenantId: tenantId,
    accountingMethod: AccountingMethod.Accrual,
  };

  const rmaRepo: any = {
    findById: async (id: string) => (id === rmaId ? mockRMA : null),
    save: async () => {},
  };

  const inventoryRepo: any = {
    findBySkus: async () => [],
    findBySku: async () => null,
    save: async () => {},
    saveMany: async () => {},
  };

  const costLayerRepo: any = {
    save: async () => {},
    saveMany: async () => {},
    findByVariant: async () => [], // needed for costLayerService
    findByVariantAndLocation: async () => [],
  };

  const quarantineRepo: any = {
    save: async () => {},
  };

  const tenantConfigRepo: any = {
    findByTenantId: async () => mockTenantConfig,
  };

  const journalRepo: any = {
    save: async () => {},
  };

  const serialItemStore = new Map<string, SerializedItem>();
  for (let i = 0; i < numItems; i++) {
    const sn = `SN-${i}`;
    const item = new SerializedItem(
      `id-${i}`,
      variantId,
      new SerialNumber(sn),
      tenantId,
      locationId,
      SerializedItemStatus.Sold
    );
    serialItemStore.set(sn, item);
  }

  // NOTE: Intentionally not providing findBySerials to force the fallback logic
  const serializedItemRepo: ISerializedItemRepository = {
    findBySerial: async (sn, tId) => serialItemStore.get(sn.value) || null,
    findBySerialOrFail: async (sn, tId) => {
        // Simulate some async DB latency
        await new Promise(resolve => setTimeout(resolve, 5));
        const res = serialItemStore.get(sn.value);
        if (!res) throw new Error("not found");
        return res;
    },
    findById: async () => null,
    findByVariant: async () => [],
    isRegistered: async () => false,
    countByStatus: async () => 0,
    save: async () => {},
    saveMany: async () => {}, // Use saveMany to speed up the end
  };

  const useCase = new ReceiveRMA(
    rmaRepo,
    inventoryRepo,
    costLayerRepo,
    quarantineRepo,
    tenantConfigRepo,
    journalRepo,
    serializedItemRepo
  );

  const dto: ReceiveRMADTO = {
    rmaId,
    items: [],
  };

  for (let i = 0; i < numItems; i++) {
    dto.items.push({
      variantId,
      quantityReceived: 1,
      disposition: RMADisposition.Restock,
      serialNumbers: [`SN-${i}`],
    });
  }

  console.log(`Starting benchmark with ${numItems} RMA items (fallback logic active)...`);
  const start = Date.now();

  await useCase.execute(dto);

  const end = Date.now();
  const duration = end - start;

  console.log(`Benchmark completed in ${duration}ms`);
}

runBenchmark().catch(console.error);
