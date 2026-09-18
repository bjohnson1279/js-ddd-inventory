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

## 2026-09-16 - Combinatorial Explosion in Routing
**Learning:** Unconstrained combinatorial generation (like recursively picking combinations of warehouses) scales at O(2^N), causing memory crashes for larger networks.
**Action:** Always pre-compute a capacity suffix array to enable aggressive branch pruning in backtracking algorithms before evaluating results.
