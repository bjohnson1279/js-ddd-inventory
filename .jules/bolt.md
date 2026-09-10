## 2024-03-24 - GetDemandPlanningReport N+1 Query Optimization
**Learning:** Sequential map/await loops over inventory items that fetch independent data (like dispatch history) for each item can cause severe N+1 query bottlenecks in reporting use cases.
**Action:** Always prefer fetching related data for the entire set of locations/items upfront into an in-memory Map (using a bulk method like \`fetchHistoryByLocation\`), and then distribute it downstream during the loop to achieve O(1) performance inside loops instead of O(N).

## 2024-03-24 - Pre-computing Rates for Order Routing Combinations
**Learning:** Nesting `Promise.all` inside recursive loops for combinatorics causes massive overhead and excessive context switches (O(N*M) concurrent executions).
**Action:** Extract network I/O calls to run sequentially or upfront in a flat array, caching the result, and evaluate the combinatorics map synchronously.
