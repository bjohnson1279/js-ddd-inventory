## 2024-07-07 - [Optimize N+1 queries in demand planning]
**Learning:** `GetDemandPlanningReport` had an N+1 query vulnerability because it iterated over inventory items and called `CalculateSalesVelocity`, which internally triggered a redundant database query to fetch the same stock value.
**Action:** Pass the already fetched inventory item's quantity as an optional parameter (`preFetchedStock`) down to `CalculateSalesVelocity.execute()` to prevent redundant lookups.
## 2024-05-24 - O(N^2) Lookup in Purchase Order / RMA / Audit receive flows
**Learning:** In the `ReceivePurchaseOrder`, `ReceiveRMA`, and `RecordAuditCount` flows, passing an array of received/counted items results in O(N^2) time complexity because the aggregate's methods (`receiveItems`, `receiveItem`, `recordCount`) perform a `.find()` on their internal `_items` array for each passed item. When dealing with hundreds or thousands of items, this creates a severe performance bottleneck.
**Action:** Implemented lazy-initialized `Map` structures inside the aggregate roots (`PurchaseOrder`, `RMA`, `InventoryAudit`) to cache item lookups. This transforms the inner lookup to O(1), improving batch processing times significantly.

## 2026-07-04 - [AuditProcessorService Optimize]
**Learning:** Found N+1 queries in AuditProcessorService.ts when fetching external accounting journal mappings inside a loop, and aggregating inventory models.
**Action:** Pre-fetched data using `groupBy` and `findMany` using `in` clause to do it in O(1) inside loop to resolve N+1 queries. Used Set for O(1) mapping verification inside the loop instead of multiple sequential `findUnique` operations.
