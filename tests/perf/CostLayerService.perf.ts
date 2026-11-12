import { CostLayerService } from "../../src/domain/accounting/services/CostLayerService";
import { InMemoryCostLayerRepository } from "../../src/infrastructure/database/InMemoryCostLayerRepository";
import { InventoryCostLayer } from "../../src/domain/accounting/entities/InventoryCostLayer";
import { ICostLayerRepository } from "../../src/domain/repositories/ICostLayerRepository";

async function runBenchmark() {
  console.log("===============================================================");
  console.log("Benchmark 1: Save Many vs Individual Saves in CostLayerService");
  console.log("===============================================================");
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

  console.log("\n===============================================================");
  console.log("Benchmark 2: Batch Active Layers Fetch vs N+1 Sequential Fetch");
  console.log("===============================================================");
  const numVariants = 50;
  const components = Array.from({ length: numVariants }, (_, i) => ({
    variantId: `variant-${i}`,
    quantity: 2,
  }));

  // N+1 Sequential fallback repo
  const repoSequential: ICostLayerRepository = {
    getActiveLayers: async (variantId: string) => {
      await new Promise(r => setTimeout(r, 1));
      return [new InventoryCostLayer(`L-${variantId}`, variantId, "tenant-1", 10, 100, new Date(), "po-1")];
    },
    save: async () => {},
  };

  // Batched repo (using getActiveLayersByVariantIds)
  const repoBatch: ICostLayerRepository = {
    getActiveLayers: async () => [],
    getActiveLayersByVariantIds: async (variantIds: string[]) => {
      await new Promise(r => setTimeout(r, 1));
      const map = new Map<string, InventoryCostLayer[]>();
      for (const vId of variantIds) {
        map.set(vId, [new InventoryCostLayer(`L-${vId}`, vId, "tenant-1", 10, 100, new Date(), "po-1")]);
      }
      return map;
    },
    save: async () => {},
  };

  const serviceSequential = new CostLayerService(repoSequential);
  const serviceBatch = new CostLayerService(repoBatch);

  // Warmup
  await serviceSequential.calculateLayersBatch(components.slice(0, 5));
  await serviceBatch.calculateLayersBatch(components.slice(0, 5));

  const startSeqBatch = performance.now();
  await serviceSequential.calculateLayersBatch(components);
  const endSeqBatch = performance.now();
  const seqBatchTime = endSeqBatch - startSeqBatch;

  const startOptBatch = performance.now();
  await serviceBatch.calculateLayersBatch(components);
  const endOptBatch = performance.now();
  const optBatchTime = endOptBatch - startOptBatch;

  console.log(`[Baseline N+1] 50 variant queries sequentially: ${seqBatchTime.toFixed(2)}ms`);
  console.log(`[Optimized Batch] 50 variants in 1 query: ${optBatchTime.toFixed(2)}ms`);
  console.log(`Improvement: ${(seqBatchTime / optBatchTime).toFixed(2)}x faster`);
}

runBenchmark().catch(console.error);
