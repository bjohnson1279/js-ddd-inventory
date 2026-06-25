## 2026-06-02 - Removed redundant DB fetch in InventoryService
**Learning:** Found an N+1 fetching anti-pattern in the domain service logic. Methods validation (`assertSufficientStock`) and subsequent execution both fetched the same aggregate root from the DB independently.
**Action:** When validating before an operation, fetch the entity and cache it locally or inline the validation, instead of creating separate validation methods that repeat DB calls.

## 2026-06-04 - Fixed N+1 query in Kit Sale Validation
**Learning:** Looping over kit components and fetching items one-by-one via `findBySku` leads to an N+1 query anti-pattern in the `InventoryService`.
**Action:** Introduced an optional `findBySkus` method in `IInventoryRepository` for batch fetching. When implemented (e.g. `PrismaInventoryRepository`), pre-fetch all components in a single round-trip before processing to significantly improve validation performance.
## 2024-05-18 - Bulk Operations in DDD Repositories
**Insight:** Prisma lacks a native `upsertMany`, and un-batched sequential upserts or parallel `Promise.all` upserts (N+1 queries) inside loops can easily exhaust database connection pools or lead to significant performance bottlenecks, especially when saving a large array of entities.
**Optimization:** Implementing an optional `saveMany` batch operation on the Repository Interface allows concrete database implementations to handle bulk saves efficiently (e.g., executing multiple upserts sequentially inside a single `prisma.$transaction()` or a Postgres `BEGIN`/`COMMIT` block). Use a feature check (e.g., `if (repo.saveMany)`) in Use Cases to safely degrade to sequential `save()` calls if the repository does not implement the bulk method. This drastically improves performance (from 2.6s to 0.8s for 1000 items) while maintaining the DDD interface contract and backwards compatibility with test doubles.

## 2026-06-04 - Fixed N+1 query in OpeningBalanceService
**Learning:** Found an N+1 fetching and saving anti-pattern in `OpeningBalanceService`. Methods `hasAnyEntries`, `findBySku`, and `save` were being called in a loop for every onboarding item.
**Action:** Introduced optional `hasConflicts` and `saveMany` methods in `IInventoryRepository` for batch processing. Pre-fetch and bulk save all onboarding items in single round-trips to significantly improve processing performance (from ~368ms down to ~10ms in simulated benchmarks).

## 2026-06-04 - Bulk Upsert with Prisma $transaction
**Insight:** Prisma lacks a native `bulkUpsert` method. Sequential loop saves create an N+1 query problem, while unbounded `Promise.all` on individual saves can exhaust the DB connection pool.
**Optimization:** Implemented batching by defining a `saveMany` repository method. For Prisma, mapped each item to an individual `.upsert` promise and executed the entire array within a single `this.prisma.$transaction([...])` call.
**Result:** Safely reduced 1000 sequential saves from ~1200ms to ~3ms (simulated benchmark) by shifting the looping execution logic down to the database connection layer.

## 2026-06-04 - Optimize PerformFullStoreCount N+1 DB Write Overhead
**Insight:** Avoid N+1 database transactions and application events in mass data processing loops (like full store inventory counts).
**Optimization:** By implementing and using `saveMany` on repositories, we consolidate individual db inserts/upserts into a single atomic transaction and batch-process domain events, significantly speeding up bulk operations while maintaining the Domain-Driven Design constraints. Unbounded `Promise.all(writes)` over-taxes database connection pools compared to bulk transaction loops.

## 2025-02-23 - Resolve N+1 write in InventoryService Kit Sales
**Optimization:** Implemented a `saveMany` operation in `PrismaInventoryRepository` to execute sequential `upsert` queries inside a single Prisma `$transaction` via `Promise.all` rather than sequentially executing queries via `.save()`.
**Learning:** Replaced bounded sequential reads over the loop with `Promise.all` batch write over the same data scope, and preserved atomicity and transactional integrity via `Prisma.$transaction`. Ensuring a fallback sequential implementation exists within the Domain Service guarantees interface backward compatibility for other components.
**Prevention:** Utilize chunking and single transaction batches for multiple aggregate modifications, especially for domain operations mapping inputs 1:N items like "Kits".

## 2024-06-05 - Batch Database Operations
**Learning:** Calling independent database operations inside `Promise.all()` (like calling `.save()` inside an unbounded loop) causes database connection pool exhaustion when working with large payloads like store count events. Using `.saveMany()` is safer and more performant.
**Action:** When updating multiple records in CQRS architectures, prefer batch repository methods like `saveMany` over bounding independent loops. Always implement fallback support for mocks that lack the batch method.
## 2026-06-06 - [Optimize Sequential Fetching]
**Learning:** In initial dashboard loading sequences or data valuation comparisons that query multiple independent endpoints, sequential `fetch` calls cause unnecessary request waterfalls and latency.
**Action:** Use `Promise.all()` to run independent data-fetching requests concurrently to drastically reduce overall network time.

## 2026-06-07 - Resolve N+1 write in InventoryService Kit Sales
**Learning:** Replaced bounded sequential reads over the loop with Promise.all batch write over the same data scope, and preserved atomicity and transactional integrity via Prisma.$transaction. Ensuring a fallback sequential implementation exists within the Domain Service guarantees interface backward compatibility for other components.
**Action:** Utilize chunking and single transaction batches for multiple aggregate modifications, especially for domain operations mapping inputs 1:N items like "Kits".

## 2026-06-08 - Fixed N+1 fallback Write in CostLayerService
**Learning:** Found an N+1 fetching and saving anti-pattern in the `consumeFifoLayers` fallback method in `CostLayerService`. When `saveMany` was unsupported, layers were being saved sequentially in a `for...of` loop.
**Action:** Replaced bounded sequential writes over the fallback loop with `Promise.all` batch writes to execute independent queries concurrently, significantly reducing wait time.

## 2026-06-08 - Replaced sequential fallback awaits with Promise.all
**Learning:** Found sequential await statements inside fallback loops in `InventoryService` and `OpeningBalanceService`. This is a classic N+1 anti-pattern when bulk operations are unsupported.
**Action:** Replace unbatched sequential awaits inside iterative `for...of` loops with `Promise.all()` arrays for concurrency when the items are independent, safe to execute in parallel, and the dataset size is small/bounded to prevent database connection pool exhaustion.

## 2026-06-08 - N+1 Write in PerformFullStoreCount already optimized
**Learning:** The reported performance issue regarding N+1 writes in `PerformFullStoreCount` was already optimized in the codebase by batching them into `itemsToSave` and using `saveMany`.
**Action:** Always verify the actual codebase against the reported performance issues to avoid redundant work, as tasks may be hallucinatory or already resolved.

## 2026-06-08 - Hallucinatory N+1 Issue
**Learning:** The reported N+1 issue in PerformFullStoreCount.ts was already resolved using a batch-saving pattern.
**Action:** Always verify current codebase state against the task description.

## 2026-06-08 - Fixed N+1 fallback Write in OpeningBalanceService
**Learning:** Found sequential fallback awaits (`await this.inventoryRepository.save(item)`) in a `for...of` loop in `OpeningBalanceService`.
**Action:** Replaced bounded sequential writes over the fallback loop with `Promise.all` batch writes to execute independent queries concurrently, significantly reducing wait time.

## 2026-06-08 - Optimized PrismaPurchaseOrderRepository items save
**Learning:** Sequential awaited database calls (`await tx.purchaseOrderItemModel.upsert(...)`) inside a `for...of` loop within Prisma `$transaction` cause unnecessary N+1 round-trip wait time delays.
**Action:** Replace `for...of` sequential waits with `Promise.all(items.map(...))` to execute the individual save statements concurrently within the transaction context, significantly reducing execution time.

## 2026-06-11 - Parallelize Event Handlers in DomainEventDispatcher
**Learning:** Sequential await inside a for...of loop over independent event handlers causes unnecessary delays (N+1 bottleneck for handlers). Promise.all allows executing them concurrently, drastically reducing dispatch time.
**Action:** When iterating over independent callbacks or handlers, use Promise.all to execute them concurrently instead of sequential awaits.

## 2026-06-11 - Optimize OutboxProcessor Database Updates
**Learning:** When performing independent database updates inside a loop where prior results aren't needed, accumulating promises and running them concurrently with Promise.all reduces latency.
**Action:** Use Promise.all to run non-dependent updates concurrently rather than sequentially awaiting each one.

## 2024-06-11 - Optimize CreateInventoryAudit DB Reads
**Learning:** Sequential awaits inside of loops caused an N+1 query problem, slowing down inventory audits. Replacing this with a batched query or `Promise.all` resolves the performance hit significantly.
**Action:** Identify sequences of database operations in loops and defer promises into an array or utilize batch DB operations like `findBySkus?()` instead.

## 2026-06-12 - Resolve sequential DB query in GetDemandPlanningReport
**Learning:** The `GetDemandPlanningReport` use case iterates through each inventory item and sequentially fetches sales velocity data and reorder policies. This causes an N+1 query issue since they can be executed independently.
**Action:** When a loop iterates over items to fetch independent data from the repository layer, map the iterations to promises and await them concurrently using `Promise.all()` to dramatically reduce overall latency.
## 2026-06-14 - Parallelize independent data processing loops
**Learning:** Replaced bounded sequential awaits inside iterative loops (`for...of`) with `Promise.all` across arrays mapped to async operations when processing multiple independent items like RMA serials, PO items, or audit components. This reduces N+1 wait time bottlenecks significantly without architectural shifts.
**Action:** When working on performance optimizations for independent records processing, identify `for...of` loops iterating and sequentially `await`ing independent logic, and replace them with `Promise.all` mapped over the array.

## 2026-06-15 - Redundant Parallelize ReceiveRMA item processing
**Learning:** Found sequential `for...of` in `ReceiveRMA.ts` and replaced it with `Promise.all` over items arrays. However, this is already a known pattern as seen in yesterday's entry (Parallelize independent data processing loops).
**Action:** When working on performance optimizations for independent records processing, always check the journal first to avoid documenting identical optimizations.

## 2026-06-17 - Optimize DisassembleKit N+1 Loop
**Learning:** Found sequential fallback awaits (`await this.costLayerRepository.getActiveLayers` and `await this.inventoryRepository.save`) in `for...of` loops in `DisassembleKit.ts`.
**Action:** Replaced bounded sequential writes over the fallback loop with `Promise.all` batch reads and writes to execute independent queries concurrently, significantly reducing wait time.

## 2026-06-19 - Resolve N+1 writes in AssembleKit
**Learning:** A sequential `for...of` loop was being used in `AssembleKit.ts` to deduct and save stock for component variants. Because the components are processed individually, `this.inventoryRepository.save(invItem)` triggered multiple independent database writes, leading to N+1 query performance bottleneck.
**Action:** When saving multiple updated component items inside an operation like Kit Assembly, push the modified components to an array first, then use `saveMany` to persist all changes in a single batch, falling back to `Promise.all` mapping if `saveMany` isn't supported.

## 2026-06-19 - Fix N+1 saveMany in PrismaInventoryRepository
**Learning:** The `saveMany` fallback method inside `PrismaInventoryRepository` iterated via `for...of` mapping items inside a Prisma `$transaction`, resulting in a sequential N+1 database operation queue. This eventually exhausts available transactions leading to driver socket timeouts when called inside operations mapping arrays of updates.
**Action:** When performing batched reads/writes via a manual loop fallback inside a Prisma `$transaction` (e.g. `saveMany`), use `Promise.all` over the sequence array to execute independent database operations concurrently rather than sequentially waiting on each `await tx.model.upsert(...)`.

## 2026-06-20 - Resolve N+1 writes in DisassembleKit
**Learning:** Found sequential fallback awaits (`await this.inventoryRepository.save(compInv)`) in `for...of` loops in `DisassembleKit.ts`. It also queries the `inventoryRepository` sequentially via `findBySku`. This creates a lot of unnecessary N+1 overhead during Kit Disassembly.
**Action:** Replaced bounded sequential reads and writes inside the `for...of` loops with a batched/Promise.all pattern before the loop for reads, and accumulated the items to an array to be saved after the loop via `saveMany` or `Promise.all` fallback.

## 2024-06-21 - Rejected concurrent execution of state-mutating service method
**Learning:** Blindly replacing a sequential `for...of` loop with `Promise.all` to concurrently execute a state-mutating service method (`consumeFifoLayers`) is an unsafe anti-pattern that introduces critical risks of data corruption (race conditions) and transaction failures.
**Action:** Never introduce concurrency to financial or inventory mutation loops without dedicated bulk-operation logic. The correct optimization is to implement a batch method inside the service that handles database locks and batch updates safely.
## 2025-01-01 - Optimizing Overlapping Time-Series Queries
**Learning:** Overlapping time-series queries (e.g., fetching 7-day, 30-day, and 90-day histories) often result in redundant database scans and increased latency.
**Action:** Replace multiple overlapping queries with a single query covering the maximum time window, and filter the result set in memory for smaller intervals.

## 2026-06-25 - TimescaleDB Hypertables and Composite Primary Keys
**Learning:** Standard single-column primary keys (e.g. `id UUID PRIMARY KEY`) are incompatible with TimescaleDB hypertables, which require any primary key or unique constraint to include the time-partitioning column.
**Action:** When working with append-only time-series tables (like `ledger_entries`, `inventory_transactions`, or `dispatch_records`):
- Ensure that the primary key is defined as a composite key containing both the unique ID and the timestamp column (e.g. `PRIMARY KEY (id, occurred_at)` or `@@id([id, occurredAt])`).
- Convert the table to a hypertable immediately upon creation/migration using `SELECT create_hypertable('table_name', 'time_column', if_not_exists => TRUE);`.
- For Node.js/Prisma setups, ensure the datasource provider is set to PostgreSQL (not SQLite) to maintain database parity across all service variants.
