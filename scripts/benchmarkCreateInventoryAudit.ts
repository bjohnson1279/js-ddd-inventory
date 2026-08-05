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

  const auditRepository2 = new InMemoryInventoryAuditRepository();
  const useCaseOptimized = new CreateInventoryAudit(auditRepository2, inventoryRepository);

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
