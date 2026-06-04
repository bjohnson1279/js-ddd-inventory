## 2026-06-02 - Removed redundant DB fetch in InventoryService
**Learning:** Found an N+1 fetching anti-pattern in the domain service logic. Methods validation (`assertSufficientStock`) and subsequent execution both fetched the same aggregate root from the DB independently.
**Action:** When validating before an operation, fetch the entity and cache it locally or inline the validation, instead of creating separate validation methods that repeat DB calls.
## 2026-06-04 - Fixed N+1 query in Kit Sale Validation
**Learning:** Looping over kit components and fetching items one-by-one via `findBySku` leads to an N+1 query anti-pattern in the `InventoryService`.
**Action:** Introduced an optional `findBySkus` method in `IInventoryRepository` for batch fetching. When implemented (e.g. `PrismaInventoryRepository`), pre-fetch all components in a single round-trip before processing to significantly improve validation performance.
## 2026-06-04 - Optimize PerformFullStoreCount N+1 DB Write Overhead
**Insight:** Avoid N+1 database transactions and application events in mass data processing loops (like full store inventory counts).
**Optimization:** By implementing and using `saveMany` on repositories, we consolidate individual db inserts/upserts into a single atomic transaction and batch-process domain events, significantly speeding up bulk operations while maintaining the Domain-Driven Design constraints. Unbounded `Promise.all(writes)` over-taxes database connection pools compared to bulk transaction loops.
