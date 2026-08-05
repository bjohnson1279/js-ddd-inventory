## 2024-06-25 - N+1 Query in Promise.all Loop for ReconcileInventoryAudit
**Learning:** ReconcileInventoryAudit was processing shrinkages inside a `Promise.all` loop and invoking `consumeFifoLayers`, resulting in an N+1 query issue for fetching and saving cost layers.
**Action:** When a method inside a `Promise.all` executes sequential queries, extract the components before the loop, use batching (like `consumeFifoLayersBatch`), and map the results for O(1) in-memory lookup during the loop to prevent N+1 queries.
## 2023-10-27 - Fix N+1 queries in CostLayerService batched consumption
**Learning:** Checking for optional bulk methods (like `getActiveLayersByVariantIds`) on repositories before falling back to `Promise.all` can prevent N+1 query patterns when loading multiple entities in a batch operation.
**Action:** Always verify if a repository interface exposes an optional bulk-fetch method before defaulting to a concurrent loop of single-entity lookups, especially within `*Batch` designated methods.
## 2024-08-04 - N+1 Query in Promise.all Loop for ReconcileInventoryAudit Weighted Average Costing
**Learning:** ReconcileInventoryAudit was calculating WeightedAverageCost individually for each shrinkage item inside a `Promise.all` mapping loop, leading to an N+1 query issue for fetching cost layers.
**Action:** Extend batch methods in `CostLayerService` to support non-consuming calculations (`calculateLayersBatch`), enabling pre-fetching of active layers outside the loop for `WeightedAverageCost` shrinking scenarios.

## Hallucinatory Task & Empty PR Directives
- **Zero-Diff Task Termination**: If the requested optimization, refactor, or fix is ALREADY natively present in the target branch, DO NOT create an empty pull request or commit an acknowledgment PR. Exit the task cleanly without opening a PR.
- **Stale Suggestion Guard**: Always verify the current code on `main`/`master` before planning changes. If no actionable diff is required, cancel task execution immediately.

## 2024-08-05 - Optimize bulk sequential saves with chunked Promise.all
**Learning:** Sequential DB saves in a transaction (such as a large `for...of` loop in `saveMany`) can introduce significant performance bottlenecks through network waterfalls, while uncontrolled `Promise.all` mapping can cause transaction concurrency limits and connection pool exhaustion.
**Action:** Replace large sequential DB loop operations with chunked parallel execution (e.g. `items.slice(i, i + chunkSize)` and `Promise.all()`) to significantly reduce I/O latency while safely preserving database constraints and encapsulated ORM boundaries.
