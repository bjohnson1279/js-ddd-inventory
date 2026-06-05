import { CostLayerService } from "../../src/domain/accounting/services/CostLayerService";
import { InMemoryCostLayerRepository } from "../../src/infrastructure/database/InMemoryCostLayerRepository";
import { InventoryCostLayer } from "../../src/domain/accounting/entities/InventoryCostLayer";
import { ICostLayerRepository } from "../../src/domain/repositories/ICostLayerRepository";

async function runBenchmark() {
  const repo: any = new InMemoryCostLayerRepository();
  const originalSave = repo.save.bind(repo);
  repo.save = async (layer: any) => {
    await new Promise(resolve => setTimeout(resolve, 1));
    return originalSave(layer);
  };

  repo.saveMany = async (layers: any[]) => {
    await new Promise(resolve => setTimeout(resolve, 1));
    for (const layer of layers) {
       await originalSave(layer);
    }
  };

  const numLayers = 1000;
  const baseDate = new Date();

  // Baseline run
  for (let i = 0; i < numLayers; i++) {
    const layer = new InventoryCostLayer(`layer-${i}`, "variant-1", "tenant-1", 1, 100, new Date(baseDate.getTime() + i * 1000), "po-1");
    await repo.save(layer);
  }

  console.log(`[Baseline] Consuming ${numLayers} layers...`);
  const start1 = performance.now();

  // Directly do what baseline does
  const activeLayers1 = await repo.getActiveLayers("variant-1", "asc");
  for (const layer of activeLayers1) {
    await repo.save(layer);
  }

  const end1 = performance.now();
  const baselineTime = end1 - start1;
  console.log(`Baseline time: ${baselineTime.toFixed(2)}ms`);

  // Optimized run
  for (let i = 0; i < numLayers; i++) {
    const layer = new InventoryCostLayer(`layer-opt-${i}`, "variant-2", "tenant-1", 1, 100, new Date(baseDate.getTime() + i * 1000), "po-1");
    await repo.save(layer);
  }

  console.log(`\n[Optimized] Consuming ${numLayers} layers...`);
  const start2 = performance.now();

  const activeLayers2 = await repo.getActiveLayers("variant-2", "asc");
  if (repo.saveMany) {
    await repo.saveMany(activeLayers2);
  } else {
    for (const layer of activeLayers2) {
      await repo.save(layer);
    }
  }

  const end2 = performance.now();
  const optimizedTime = end2 - start2;
  console.log(`Optimized time: ${optimizedTime.toFixed(2)}ms`);
  console.log(`Improvement: ${(baselineTime / optimizedTime).toFixed(2)}x faster`);
}

runBenchmark().catch(console.error);
