## 2024-03-24 - GetDemandPlanningReport N+1 Query Optimization
**Learning:** Sequential map/await loops over inventory items that fetch independent data (like dispatch history) for each item can cause severe N+1 query bottlenecks in reporting use cases.
**Action:** Always prefer fetching related data for the entire set of locations/items upfront into an in-memory Map (using a bulk method like \`fetchHistoryByLocation\`), and then distribute it downstream during the loop to achieve O(1) performance inside loops instead of O(N).

## 2024-03-24 - Pre-computing Rates for Order Routing Combinations
**Learning:** Nesting `Promise.all` inside recursive loops for combinatorics causes massive overhead and excessive context switches (O(N*M) concurrent executions).
**Action:** Extract network I/O calls to run sequentially or upfront in a flat array, caching the result, and evaluate the combinatorics map synchronously.

## 2024-03-24 - Push filtering to Database for Purchase Orders
**Learning:** Fetching all items from a table (`findAll()`) to perform simple filtering or array lookups in-memory via nested `.some` and `.filter` causes extremely high database load and memory usage (O(N*M) iteration time for filtering).
**Action:** Push filter logic down to the database level, leveraging query parameters (e.g. `where: { tenantId, status: PurchaseOrderStatus.Received, items: { some: { variantId } } }`) to let the RDBMS perform the filtering efficiently.
## 2024-03-24 - Serialized Inventory Ledger Consistency Optimization
**Learning:** Fetching all inventory records into memory (`findAll()`) to filter by a single SKU causes extremely high database load and memory usage (O(N) iteration time), degrading performance as the inventory grows.
**Action:** Push filtering logic down to the database using `findAllBySku(sku)` instead of fetching everything in memory, which changes an O(N) operation to an efficient DB lookup.

## 2024-03-24 - Bulk Pre-fetch Inventory for Reorder Policies
**Learning:** Evaluating reorder policies for a large number of SKUs with a sequential loop over `inventoryRepo.findBySku(policy.sku, policy.locationId)` causes severe N+1 query bottlenecks and extremely high database load.
**Action:** Bulk pre-fetch all necessary inventory items upfront (e.g. `findAllByLocationIds` or `findAll`) before the loop and cache them in memory using a Map for O(1) lookups, changing an O(N) database load to O(1).

## 2024-03-24 - Batching Sequential Database Writes in Use Cases
**Learning:** Calling `repository.save()` inside sequential loops causes severe N+1 database queries, inflating latency proportionally to loop iterations (e.g., number of RMA lines).
**Action:** Replace sequential loop writes with a deferred batch save logic. Crucially, when deferring saves, maintain an in-memory `Map` of the entities currently being modified in the loop, and fetch from this `Map` first on subsequent iterations to prevent stale reads from the database corrupting data for identical variants.

## 2026-09-16 - Combinatorial Explosion in Routing
**Learning:** Unconstrained combinatorial generation (like recursively picking combinations of warehouses) scales at O(2^N), causing memory crashes for larger networks.
**Action:** Always pre-compute a capacity suffix array to enable aggressive branch pruning in backtracking algorithms before evaluating results.

## 2024-03-24 - Bulk Inserts over Concurrent Promise.all
**Learning:** Using `Promise.all` inside nested chunked loops for database inserts creates unnecessary latency and hits the database multiple times unnecessarily.
**Action:** Filter the items to be inserted first and use `createMany` for bulk insertion. This significantly reduces database roundtrips.

## 2024-03-24 - Avoiding Concurrent Array Maps for DB I/O (Outbox Processor)
**Learning:** Using `Promise.all` wrapped over an array to fire numerous single-record database updates (e.g. `Promise.all(processedIds.map(id => outboxRepository.markProcessed(id)))`) causes N connection pool acquisitions, query latencies, and high RDBMS contention.
**Action:** Always prefer pushing updates down to the database using bulk operations like `updateMany` combined with the `in` operator (e.g. `markProcessedMany(ids)` -> `where: { id: { in: ids } }`). This changes latency from O(N) to O(1).
## 2024-10-26 - Bulk Pre-fetch Inventory for RMAs
**Learning:** Sequential loops in RMA receiving that perform `findBySku` for each returned item cause severe N+1 query bottlenecks and extremely high database load when an RMA has many lines.
**Action:** Bulk pre-fetch all necessary inventory items upfront (e.g., using `findBySkus`) grouped by their target location (normal vs. quarantine) before the loop and cache them in an in-memory Map for O(1) lookups.

## 2024-10-26 - Optional Methods on Interfaces in TypeScript
**Learning:** If a repository interface defines a method as optional (e.g. `findBySkus?`), we shouldn't dynamically cast with `as any` and do property checks just to bypass the compiler when implementing an optimization, as that causes type fragility.
**Action:** Remove the optional `?` from the interface to enforce the method contract universally across all classes that implement the interface, enabling safe standard calls like `await this.inventoryRepository.findBySkus()`.


## Prevention Directives for Automated Refactoring
- **Never Overwrite Complete Files**: Always use range-scoped replacement chunks (`StartLine`/`EndLine`).
- **No Scratch Files**: Never stage or commit `test_*.ts`, `test_*.js`, `test.js`, or `plan.md` files to git.
- **No Unresolved Conflict Markers**: Never stage or commit files containing Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`). Always resolve conflicts cleanly before committing.
- **Path Normalization Compatibility**: When passing paths to subprocesses or external APIs, use absolute normalized paths (e.g., `os.path.abspath`) so tests pass on both Linux and Windows.
- **Zero-Diff Task Termination**: If the requested optimization, refactor, or fix is ALREADY natively present in the target branch, DO NOT create an empty pull request or commit an acknowledgment PR. Exit the task cleanly without opening a PR.

## 2024-05-18 - Picking Route Optimizer N+1 query optimization
**Learning:** In the `PickingRouteOptimizer`, looking up warehouse locations for routing input generated an N+1 database query scenario because locations were retrieved one-by-one inside a `Promise.all` block. Adding a batch fetching capability (`findByIds`) to `IWarehouseLocationRepository` and preferring it when available eliminates the need for repeated roundtrips, reducing the fetching latency from O(N) to O(1).
**Action:** When mapping multiple items to their dependencies (such as warehouse locations), look for opportunities to pre-fetch the dependencies in a single query by extending repository interfaces with batch retrieval methods like `findByIds` and falling back gracefully when the underlying infrastructure doesn't yet support it.

## 2024-03-24 - Avoiding Concurrent Database Queries in Use Cases
**Learning:** Using `Promise.all` wrapped over an array to fire numerous single-record database lookups (e.g., `Promise.all(skus.map(sku => repo.findBySku(sku)))`) inside Use Cases like `ReconcileInventoryAudit`, `AssembleKit`, `DisassembleKit`, `CreateInventoryAudit`, and `GetDemandPlanningReport` causes N+1 query latencies, massive connection pool acquisitions, and high RDBMS contention.
**Action:** Always prefer iterating sequentially or executing database lookups using bulk operations where possible instead of using `Promise.all`. This significantly reduces database roundtrips and connection pool exhaustion.

## 2024-03-24 - Serialized Inventory Ledger Consistency Optimization (Fix)
**Learning:** Fetching all inventory records into memory (`findAll()`) to filter by a single location causes extremely high database load and memory usage (O(N) iteration time), degrading performance as the inventory grows. Replacing concurrent database queries with sequential database queries does not make things faster; true optimizations require replacing many queries with a single database level filter, such as adding query string arguments.
**Action:** Push filtering logic down to the database level using `findAllByLocation(locationId)` instead of fetching everything in memory without filters.

