import { CostLayerService } from "./src/domain/accounting/services/CostLayerService";
import { ICostLayerRepository } from "./src/domain/repositories/ICostLayerRepository";
import { InventoryCostLayer } from "./src/domain/accounting/entities/InventoryCostLayer";

class MockRepository implements ICostLayerRepository {
  async getActiveLayers(variantId: string, sort?: "asc" | "desc"): Promise<InventoryCostLayer[]> {
    const layers: InventoryCostLayer[] = [];
    for (let i = 0; i < 100; i++) {
      layers.push(new InventoryCostLayer(`layer-${i}`, variantId, 'tenant1', 10, 100, new Date(), 'po1'));
    }
    return layers;
  }

  async save(layer: InventoryCostLayer): Promise<void> {
    // simulate I/O delay
    return new Promise((resolve) => setTimeout(resolve, 5));
  }

  async findById(id: string): Promise<InventoryCostLayer | null> {
    return null;
  }

  async getByVariant(variantId: string): Promise<InventoryCostLayer[]> {
    return [];
  }
}

async function run() {
  const repo = new MockRepository();
  const service = new CostLayerService(repo);

  const start = Date.now();
  await service.consumeFifoLayers("variant-1", 1000);
  const end = Date.now();
  console.log(`Baseline time: ${end - start}ms`);
}

run().catch(console.error);
