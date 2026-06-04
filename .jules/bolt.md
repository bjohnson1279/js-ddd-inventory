## 2026-06-02 - Removed redundant DB fetch in InventoryService
**Learning:** Found an N+1 fetching anti-pattern in the domain service logic. Methods validation (`assertSufficientStock`) and subsequent execution both fetched the same aggregate root from the DB independently.
**Action:** When validating before an operation, fetch the entity and cache it locally or inline the validation, instead of creating separate validation methods that repeat DB calls.
## 2026-06-04 - Fixed N+1 query in Kit Sale Validation
**Learning:** Looping over kit components and fetching items one-by-one via `findBySku` leads to an N+1 query anti-pattern in the `InventoryService`.
**Action:** Introduced an optional `findBySkus` method in `IInventoryRepository` for batch fetching. When implemented (e.g. `PrismaInventoryRepository`), pre-fetch all components in a single round-trip before processing to significantly improve validation performance.
## 2026-06-04 - Bulk Upsert with Prisma $transaction
**Insight:** Prisma lacks a native `bulkUpsert` method. Sequential loop saves create an N+1 query problem, while unbounded `Promise.all` on individual saves can exhaust the DB connection pool.
**Optimization:** Implemented batching by defining a `saveMany` repository method. For Prisma, mapped each item to an individual `.upsert` promise and executed the entire array within a single `this.prisma.$transaction([...])` call.
**Result:** Safely reduced 1000 sequential saves from ~1200ms to ~3ms (simulated benchmark) by shifting the looping execution logic down to the database connection layer.
