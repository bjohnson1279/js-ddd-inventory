import { CostLayerService } from "../../src/domain/accounting/services/CostLayerService";
import { InMemoryCostLayerRepository } from "../../src/infrastructure/database/InMemoryCostLayerRepository";
import { InventoryCostLayer } from "../../src/domain/accounting/entities/InventoryCostLayer";

async function runBenchmark() {
  const repo: any = new InMemoryCostLayerRepository();
  const originalSave = repo.save.bind(repo);
  repo.save = async (layer: any) => {
    await new Promise(resolve => setTimeout(resolve, 1));
    return originalSave(layer);
  };

  const service: any = new CostLayerService(repo);
  service.consumeFifoLayers = async function(variantId: string, quantity: number) {
    const activeLayers = await this.layers.getActiveLayers(variantId, "asc");
    const breakdown = (this as any).consumeLayers(activeLayers, quantity, true);

    const chunkSize = 50;
    for (let i = 0; i < activeLayers.length; i += chunkSize) {
      const chunk = activeLayers.slice(i, i + chunkSize);
      await Promise.all(chunk.map((layer: any) => this.layers.save(layer)));
    }

    return breakdown;
  };

  const variantId = "perf-variant";
  const numLayers = 1000;

  const baseDate = new Date();
  for (let i = 0; i < numLayers; i++) {
    const layer = new InventoryCostLayer(
      `layer-${i}`,
      variantId,
      "tenant-1",
      1,
      100, // 1 dollar
      new Date(baseDate.getTime() + i * 1000),
      "po-123"
    );
    await repo.save(layer);
  }

  console.log(`Consuming ${numLayers} layers with Promise.all...`);
  const start = performance.now();
  await service.consumeFifoLayers(variantId, numLayers);
  const end = performance.now();

  console.log(`Time taken: ${(end - start).toFixed(2)}ms`);
}

runBenchmark().catch(console.error);
