import { OpeningBalanceService } from "./src/domain/onboarding/services/OpeningBalanceService";
import { StockOnboarding } from "./src/domain/onboarding/aggregates/StockOnboarding";
import { IInventoryRepository } from "./src/domain/repositories/IInventoryRepository";
import { InventoryItem } from "./src/domain/aggregates/InventoryItem";
import { SKU } from "./src/domain/valueObjects/SKU";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

class SlowRepo implements IInventoryRepository {
  private items = new Map<string, InventoryItem>();

  async findBySku(sku: SKU): Promise<InventoryItem | null> {
    await delay(1); // 1ms network latency
    return this.items.get(sku.getValue()) || null;
  }

  async findBySkus(skus: SKU[]): Promise<InventoryItem[]> {
    await delay(2); // slightly more latency for batch
    return skus.map(sku => this.items.get(sku.getValue())).filter(Boolean) as InventoryItem[];
  }

  async findAll(): Promise<InventoryItem[]> {
    return Array.from(this.items.values());
  }

  async save(item: InventoryItem): Promise<void> {
    await delay(1); // 1ms latency
    this.items.set(item.sku.getValue(), item);
  }

  async saveMany(items: InventoryItem[]): Promise<void> {
    await delay(2);
    for (const item of items) {
      this.items.set(item.sku.getValue(), item);
    }
  }

  async hasAnyEntries(variantId: string, locationId: string): Promise<boolean> {
    await delay(1);
    return this.items.has(variantId);
  }

  async hasConflicts(variantIds: string[], locationId: string): Promise<string[]> {
    await delay(2);
    return variantIds.filter(v => this.items.has(v));
  }
}

async function run() {
  const repo = new SlowRepo();
  const service = new OpeningBalanceService(repo);

  const onboarding = new StockOnboarding("onboard-1", "loc-1", new Date());
  const numItems = 100; // 100 items with 3ms per item = ~300ms

  for (let i = 0; i < numItems; i++) {
    onboarding.setItem(`variant-${i}`, 10, 100);
  }

  onboarding.submit();

  console.log("Measuring...");
  const start = performance.now();
  await service.process(onboarding, "actor-1");
  const end = performance.now();

  console.log(`Processing ${numItems} items took ${Math.round(end - start)} ms`);
}

run().catch(console.error);
