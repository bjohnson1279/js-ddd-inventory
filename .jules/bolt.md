## 2026-06-02 - Removed redundant DB fetch in InventoryService
**Learning:** Found an N+1 fetching anti-pattern in the domain service logic. Methods validation (`assertSufficientStock`) and subsequent execution both fetched the same aggregate root from the DB independently.
**Action:** When validating before an operation, fetch the entity and cache it locally or inline the validation, instead of creating separate validation methods that repeat DB calls.
## 2026-06-04 - Fixed N+1 query in Kit Sale Validation
**Learning:** Looping over kit components and fetching items one-by-one via `findBySku` leads to an N+1 query anti-pattern in the `InventoryService`.
**Action:** Introduced an optional `findBySkus` method in `IInventoryRepository` for batch fetching. When implemented (e.g. `PrismaInventoryRepository`), pre-fetch all components in a single round-trip before processing to significantly improve validation performance.
## 2026-06-04 - Fixed N+1 query in OpeningBalanceService
**Learning:** Found an N+1 fetching and saving anti-pattern in `OpeningBalanceService`. Methods `hasAnyEntries`, `findBySku`, and `save` were being called in a loop for every onboarding item.
**Action:** Introduced optional `hasConflicts` and `saveMany` methods in `IInventoryRepository` for batch processing. Pre-fetch and bulk save all onboarding items in single round-trips to significantly improve processing performance (from ~368ms down to ~10ms in simulated benchmarks).
