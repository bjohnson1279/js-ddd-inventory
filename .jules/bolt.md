## 2024-06-25 - N+1 Query in Promise.all Loop for ReconcileInventoryAudit
**Learning:** ReconcileInventoryAudit was processing shrinkages inside a `Promise.all` loop and invoking `consumeFifoLayers`, resulting in an N+1 query issue for fetching and saving cost layers.
**Action:** When a method inside a `Promise.all` executes sequential queries, extract the components before the loop, use batching (like `consumeFifoLayersBatch`), and map the results for O(1) in-memory lookup during the loop to prevent N+1 queries.
