import { CreateInventoryAudit } from "../src/application/useCases/CreateInventoryAudit";
import { InMemoryInventoryAuditRepository } from "../src/infrastructure/database/InMemoryInventoryAuditRepository";
import { InMemoryInventoryRepository } from "../src/infrastructure/database/InMemoryInventoryRepository";
import { SKU } from "../src/domain/valueObjects/SKU";
import { Quantity } from "../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../src/domain/aggregates/InventoryItem";

async function runBenchmark() {
  const auditRepository = new InMemoryInventoryAuditRepository();
  const inventoryRepository = new InMemoryInventoryRepository();

  const tenantId = "TEN-1";
  const locationId = "loc-A";

  const numItemsToFetch = 1000;

  console.log(`Seeding ${numItemsToFetch} items...`);
  for (let i = 0; i < numItemsToFetch; i++) {
    const variantId = `VAR-${i}`;
    const sku = SKU.create(variantId);
    const item = InventoryItem.create(`inv-${i}`, sku, locationId, Quantity.create(10));
    await inventoryRepository.save(item);
  }

  // Simulate missing findBySkus to force the fallback
  delete (inventoryRepository as any).findBySkus;

  // Add slight network latency to findBySku
  const originalFindBySku = inventoryRepository.findBySku.bind(inventoryRepository);
  inventoryRepository.findBySku = async (sku, location) => {
      await new Promise(r => setTimeout(r, 1));
      return originalFindBySku(sku, location);
  };

  // Add network latency to findAllByLocation
  const originalFindAll = inventoryRepository.findAllByLocation.bind(inventoryRepository);
  inventoryRepository.findAllByLocation = async (location) => {
      await new Promise(r => setTimeout(r, 10)); // 10ms for bulk query
      return originalFindAll(location);
  };

  const useCase = new CreateInventoryAudit(auditRepository, inventoryRepository);

  console.log(`\nRunning original N+1 (empty variantIds)...`);
  const startFallback = Date.now();
  await useCase.execute({
    auditNumber: "AUD-FALLBACK",
    tenantId,
    locationId,
    variantIds: [], // Force it to fetch all, triggering the N+1
  });
  const endFallback = Date.now();
  console.log(`Time: ${endFallback - startFallback}ms`);

  // Patch the useCase to simulate our proposed fix
  const auditRepository2 = new InMemoryInventoryAuditRepository();
  const useCaseOptimized = new CreateInventoryAudit(auditRepository2, inventoryRepository);

  useCaseOptimized.execute = async function(dto) {
    const existing = await this['auditRepository'].findByNumber(dto.auditNumber);
    if (existing) throw new Error();

    let variants = dto.variantIds;
    let inventoryItems: InventoryItem[] = [];

    if (!variants || variants.length === 0) {
      inventoryItems = await this['inventoryRepository'].findAllByLocation(dto.locationId);
      variants = inventoryItems.map((item: any) => item.sku.getValue());
    } else {
      const skus = variants.map((v: string) => SKU.create(v));
      const fetchPromises = skus.map(async (sku) => {
        return await this['inventoryRepository'].findBySku(sku, dto.locationId);
      });
      const results = await Promise.all(fetchPromises);
      inventoryItems = results.filter((item: any): item is InventoryItem => item !== null && item !== undefined);
    }

    // Proposed Fix: Use a Map for O(1) lookups instead of potentially finding items in a loop
    const itemsBySku = new Map(inventoryItems.map((item: any) => [item.sku.getValue(), item]));
    const auditItems: any[] = [];

    for (const variantId of variants) {
      const inventoryItem = itemsBySku.get(variantId);
      const expectedQuantity = inventoryItem ? inventoryItem.quantity.getValue() : 0;
      auditItems.push({
        variantId,
        expectedQuantity
      });
    }

    return { id: 'mock' } as any;
  }

  console.log(`\nRunning optimized (reusing items)...`);
  const startOptimized = Date.now();
  await useCaseOptimized.execute({
    auditNumber: "AUD-OPTIMIZED",
    tenantId,
    locationId,
    variantIds: [], // Force it to fetch all
  });
  const endOptimized = Date.now();
  console.log(`Time: ${endOptimized - startOptimized}ms`);
}

runBenchmark().catch(console.error);
