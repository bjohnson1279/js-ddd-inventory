## 2024-05-18 - Type-Safe Feature Detection for Optimizations
**Learning:** When attempting to use optimized repository methods (like `getActiveLayersByVariantIds`) that might not be present on all repository implementations, you must use safe duck-typing (`'getActiveLayersByVariantIds' in repository && typeof (repository as any).getActiveLayersByVariantIds === 'function'`) and handle unexpected return types carefully. Never blindly assume an interface has a method if the type checker complains, and do not use `try/catch` fallbacks that swallow database errors, as this masks connection failures and causes silent data corruption.
**Action:** Always wrap optimized batch/bulk operations in strict type and presence checks, deduplicate input arrays before fetching, and gracefully fall back to executing concurrent individual promises WITHOUT swallowing internal exceptions.
## 2026-08-28 - O(N) lookup inside recursive combinatorial paths
**Learning:** In algorithms generating combinatorial paths (e.g. `OrderRoutingEngine` evaluating many fulfillment permutations), executing an O(N) array `.find()` inside the inner loop evaluating the generated plans causes severe performance degradation as the number of combinations grows (O(2^N)). My benchmark showed O(N) nested inside O(2^N) took ~3200ms compared to a flat ~45ms when the array search was replaced with a pre-computed O(1) `Map`.
**Action:** When working on algorithms generating combinations, trees, or recursive paths, always pre-compute a `Map` strictly outside the generation/evaluation logic to ensure O(1) lookups for references required within the inner loop. Never use `.find()`, `.filter()`, or `.indexOf()` inside O(2^N) inner loops.
## 2024-09-02 - Array.find in recursive OrderRoutingService
**Learning:** The `OrderRoutingService` evaluates all possible permutations for order fulfillment across available warehouses. In `evaluateAllocations`, an O(N) `Array.find` was repeatedly used to look up warehouse details for each group in the allocation. Since this function is called at the leaf nodes of the recursive search tree, the overhead compounds significantly as the combinations grow. Replacing this with a pre-computed `Map` of warehouses drastically reduced execution time in benchmarks (e.g., from ~12.2s to ~130ms for larger datasets).
**Action:** When designing recursive algorithms that explore large solution spaces, eliminate O(N) lookup functions within the innermost evaluation loop. Pre-compute mappings at the start of the algorithm to convert these to O(1) lookups.

## 2024-09-02 - N+1 Webhook Deliveries via Promise.all
**Learning:** When multiple webhook subscriptions match a single emitted domain event, using `Promise.all(subscriptions.map(sub => prisma.webhookDeliveryModel.create({ ... })))` creates severe N+1 insert queries that can exhaust the database connection pool. Since Prisma's `create` operations return the inserted records but the `OutboxProcessor` does not assign or use these return values, we can safely substitute this pattern with `createMany`.
**Action:** Always replace concurrent individual database inserts via `Promise.all` with a single batch operation like `createMany` when the inserted entities' IDs or return objects are not strictly required for subsequent synchronous logic in the immediate scope.

## 2024-11-20 - O(N^2) lookup optimization via pre-sorting
**Learning:** Nested loops where the inner loop checks an array to find a specific target (like a minimal difference or distance) can easily cause O(N^2) bottlenecks when operating on the same large array.
**Action:** When working on algorithms requiring nested array comparisons for proximity or difference mapping, do not exhaustively search the inner loop. Instead, pre-sort a shallow copy of the target array based on the desired target attribute (e.g. `distance`). This allows the inner loop to find the exact match immediately and implement an early `break`, significantly reducing time complexity from O(N^2) to O(N log N) + pruned O(N).

## Prevention Directives for Automated Refactoring
- **Never Overwrite Complete Files**: Always use range-scoped replacement chunks (`StartLine`/`EndLine`) for edits to `schema.prisma`, `index.ts`, `public/index.php`, or DDL SQL scripts.
- **Do Not Remove Core Declarations**: Do not delete existing route registrations or database DDL tables.
- **Environment Isolation Compatibility**: When replacing fallback secrets, preserve test environment execution via `!getenv('APP_ENV')` or `getenv('APP_ENV') === 'testing'`.
- **No Scratch Files**: Never stage or commit `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `test.js` files to git.
- **No Unresolved Conflict Markers**: Never stage or commit files containing Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`). Always resolve conflicts cleanly before committing.

## Hallucinatory Task & Empty PR Directives
- **Zero-Diff Task Termination**: If the requested optimization, refactor, or fix is ALREADY natively present in the target branch, DO NOT create an empty pull request or commit an acknowledgment PR. Exit the task cleanly without opening a PR.
- **Stale Suggestion Guard**: Always verify the current code on `main`/`master` before planning changes. If no actionable diff is required, cancel task execution immediately.

