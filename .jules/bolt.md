## 2024-06-25 - N+1 Query in Promise.all Loop for ReconcileInventoryAudit
**Learning:** ReconcileInventoryAudit was processing shrinkages inside a `Promise.all` loop and invoking `consumeFifoLayers`, resulting in an N+1 query issue for fetching and saving cost layers.
**Action:** When a method inside a `Promise.all` executes sequential queries, extract the components before the loop, use batching (like `consumeFifoLayersBatch`), and map the results for O(1) in-memory lookup during the loop to prevent N+1 queries.
## 2023-10-27 - Fix N+1 queries in CostLayerService batched consumption
**Learning:** Checking for optional bulk methods (like `getActiveLayersByVariantIds`) on repositories before falling back to `Promise.all` can prevent N+1 query patterns when loading multiple entities in a batch operation.
**Action:** Always verify if a repository interface exposes an optional bulk-fetch method before defaulting to a concurrent loop of single-entity lookups, especially within `*Batch` designated methods.
