## 2024-07-07 - [Optimize N+1 queries in demand planning]
**Learning:** `GetDemandPlanningReport` had an N+1 query vulnerability because it iterated over inventory items and called `CalculateSalesVelocity`, which internally triggered a redundant database query to fetch the same stock value.
**Action:** Pass the already fetched inventory item's quantity as an optional parameter (`preFetchedStock`) down to `CalculateSalesVelocity.execute()` to prevent redundant lookups.
## 2024-05-24 - O(N^2) Lookup in Purchase Order / RMA / Audit receive flows
**Learning:** In the `ReceivePurchaseOrder`, `ReceiveRMA`, and `RecordAuditCount` flows, passing an array of received/counted items results in O(N^2) time complexity because the aggregate's methods (`receiveItems`, `receiveItem`, `recordCount`) perform a `.find()` on their internal `_items` array for each passed item. When dealing with hundreds or thousands of items, this creates a severe performance bottleneck.
**Action:** Implemented lazy-initialized `Map` structures inside the aggregate roots (`PurchaseOrder`, `RMA`, `InventoryAudit`) to cache item lookups. This transforms the inner lookup to O(1), improving batch processing times significantly.
## 2026-07-09 - [Optimize N+1 query in ReorderPolicyService evaluatePolicies]
**Learning:** Found an N+1 query where `this.poRepository.findAll()` was called inside a loop over `policies` during `evaluatePolicies`.
**Action:** When a method iterates over a set of items (like policies) and requires checking a global state (like all POs), fetch the global state once before the loop and use it within the loop to avoid N+1 database queries.
## 2026-07-11 - Pre-fetch optimization correctly prevents N+1 queries during mapping loop but needs deferring db saves
**Learning:** When refactoring mapping loops using `Promise.all()` into batched operations, we must trace side-effects (like cost layer creation vs saving). Since the batch saving executes after the loop, we must explicitly exclude scrap layers from batch saves if they are consumed locally within the same mapped loop block.
**Action:** Use pre-fetching with Maps over `findBySkus` properly, and adapt domain execution ordering accordingly.
