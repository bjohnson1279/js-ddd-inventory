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


## 2024-05-15 - Prisma Promise.all() Transactions
**Learning:** In Prisma interactive transactions (`$transaction`), firing multiple database operations using `Promise.all` (like `Promise.all(items.map(...))`) causes connection contention and deadlocks because Prisma queues these queries on the single shared transaction connection.
**Action:** Always refactor sequential updates/inserts within a Prisma transaction from `Promise.all` mapping to a simple synchronous `for...of` loop, unless you can use `updateMany`/`createMany`. This avoids deadlocks and unpredictable behavior while improving reliability.

## Prevention Directives for Automated Refactoring
- **Never Overwrite Complete Files**: Always use range-scoped replacement chunks for edits to `schema.prisma`, `index.ts`, `public/index.php`, `db/schema.rb`, or DDL SQL scripts.
- **Do Not Remove Core Declarations**: Do not delete existing route registrations or database DDL tables.
- **Environment Isolation Compatibility**: When replacing fallback secrets, preserve test environment execution via `!getenv('APP_ENV')` or `getenv('APP_ENV') === 'testing'`.
- **No Scratch Files**: Never stage or commit `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `test.js` files to git.
- **No Unresolved Conflict Markers**: Never stage or commit files containing Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`). Always resolve conflicts cleanly before committing.

## Completeness & Verification Directives
- **Explicit Parameter & Contract Validation**: When creating or modifying API endpoints (Express, Fastify, Rails, Laravel), always implement explicit parameter and request body validation schemas (e.g. `z.string().uuid()`) to prevent unhandled 404/500 fallthroughs.
- **Database Indexing for Queries**: When addressing query bottlenecks or adding query lookup filters, always implement native database index migrations rather than loading collections into memory and performing array filtering (`.filter()`, `.select`).
- **Co-Occurring Dependency Auditing**: When bumping any dependency version, verify that other transitive dependencies do not carry high/critical security advisories (e.g. run `bundler-audit`, `npm audit`). Never introduce a version bump that breaks underlying framework APIs.
- **Self-Verification Before Commit**: Always run syntax checks (`bash -n` for shell scripts, `tsc --noEmit` for TypeScript, linter checks) and targeted test runners locally before opening or updating a PR.

## Hallucinatory Task & Empty PR Directives
- **Zero-Diff Task Termination**: If the requested optimization, refactor, or fix is ALREADY natively present in the target branch, DO NOT create an empty pull request or commit an acknowledgment PR. Exit the task cleanly without opening a PR.
- **No Journal-Only PRs**: Never open a pull request that only contains updates to .jules/*.md files without corresponding functional code changes and tests.
- **Stale Suggestion Guard**: Always verify the current code on `main`/`master` before planning changes. If no actionable diff is required, cancel task execution immediately.

## Assertiveness, Decisive PR Execution & Comparative Recommendations
- **Proactive & Decisive PR Submission**: Do NOT repeatedly pause to ask permission to open a pull request (e.g., avoid "Would you like me to open a PR for this?", "Can I submit the PR?", "Should I go ahead and create the PR?"). When an optimization, fix, or feature satisfies requirements, passes local test runners/linters, and preserves architectural invariants, proceed decisively to create and submit the Pull Request with a clear, structured summary and rationale.
- **Explicit Recommendations on Options**: When presenting multiple implementation strategies or architecture options (e.g., Option A vs. Option B), NEVER leave the choice open-ended or passive. Always make an explicit, reasoned recommendation (prefixed with `(Recommended)`) based on **overall technical effectiveness**:
  1. *Algorithmic & Complexity Gains*: Time and space complexity impact (O(N*M) -> O(N+M), reduction of nested scans).
  2. *Resource Overhead*: Heap allocations, memory pressure, and GC pause reduction.
  3. *Domain & Architecture Invariants*: Strict backward compatibility, contract stability, and prevention of regression risks.
  4. *Security & Reliability*: Input validation, cryptographic safety, and concurrency safety.
- **Lead with Recommended Path**: State clearly why the recommended solution delivers the highest net value and immediately execute or propose it as the primary course of action rather than asking open-ended questions.

## Scope Verification, Minimal Churn & CI Protection Directives
- **Scope Verification Before Variable Binding**: When adding interactive states or accessibility attributes (e.g. `disabled={loading}`, `aria-busy={loading}`, `isSubmitting`), NEVER assume a variable identifier exists. Always inspect component props, local state hooks (`useState`), or declaration scope first. If not defined, declare the state hook or reuse an existing scope variable. Never introduce TS2304 / TS2552 ("Cannot find name") compile errors.
- **Surgical Edits Only (No Whole-File Formatting)**: Never run whole-file code formatters (Prettier, Black, Pint, rustfmt) across unmodified lines. Changes must be strictly range-scoped and limited to the minimal AST block needed. Avoid noisy quote/whitespace churn that masks real logic changes and causes merge conflicts. Verify with `git diff -w` that non-functional churn is zero.
- **Zero Scratch File Commits**: Never stage or commit ad-hoc verification, patch, or debug scripts (`test.cjs`, `fix_*.cjs`, `fix_*.php`, `patch_*.py`, `patch_*.sh`, `scratch_*`). Execute checks via the project's native test commands (`npm test`, `pytest`, `phpunit`, etc.) and delete temporary scripts before creating git commits.
- **Never Weaken CI Workflows**: Do not modify `.github/workflows/**` to bypass failures (e.g. adding `|| true`, setting `continue-on-error: true`, or commenting out assertions). Always resolve the defect in the source code or test fixture.
- **Explicit Parameter & Variable Types**: In TypeScript files, avoid implicit `any` by always providing explicit types on functions, parameters, and arrow callbacks (e.g. `(id: string) => ...`). Verify zero type errors with `tsc --noEmit` before committing.

## 2026-09-29 - Surgical Optimization Edits and No Scratch Script Commits
**Learning:** Running whole-file formatters or regenerating entire components while performing performance optimizations introduces massive whitespace/formatting diffs (1,000+ lines), masking the real optimization, invalidating git blame, and causing painful merge conflicts with concurrent PRs. Additionally, committing scratch benchmark or patch scripts (`patch_*.py`, `test.cjs`) pollutes production repositories and triggers CI guardrail failures.
**Action:** Restrict all algorithmic and performance optimizations to strictly scoped replacement chunks. Diff size must reflect only the functional optimization. Always clean up temporary benchmark or patch scripts with `git rm -f` before committing.

## Additive Documentation & Scratch Cleanliness Directives
- **Strictly Additive Journal Updates**: When updating `.jules/*.md`, strictly append new dated entries (`## YYYY-MM-DD - Title`). NEVER delete, truncate, or overwrite historical learnings or previous entries.
- **Substantive Code Diff Requirement**: Pull requests must include substantive code changes in `src/`, `app/`, `lib/`, or `tests/`. Never open PRs that modify only `.jules/*.md` journals or root scratch scripts.
- **Zero Scratch File Commits**: Never commit `*.diff`, `*.patch`, `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `patch_*.py` files. Always remove temporary debugging or verification scripts prior to committing.

## Scope Quarantine, Journaling & Security Test Invariants
- **Strictly Append-Only Journaling**: When adding learnings to `.jules/*.md`, append strictly at the end of the file. Do not rewrite, deduplicate, or remove lines beginning with `## YYYY-MM-DD`.
- **Surgical Scope Quarantine**: Modify only the files directly involved in the issue and their corresponding test fixtures. Do not delete, rename, or perform drive-by cleanups of unrelated root-level scripts or legacy files.
- **Coupled Test Fixture Awareness for Security Invariants**: When changing fail-open fallback behavior (such as hardening decryption to fail closed), always update upstream test mocks that rely on plaintext credentials or mock values.

## 2024-03-24 - Avoiding Promise.all map for Demand Planning
**Learning:** Using `Promise.all` wrapped over an array to fire numerous single-record database lookups inside `GetDemandPlanningReport` causes N+1 query latencies, massive connection pool acquisitions, and high RDBMS contention, leading to database timeouts.
**Action:** Always prefer iterating sequentially or executing database lookups using bulk operations where possible instead of using `Promise.all` to query database row by row in parallel. This significantly reduces database connection pool exhaustion and deadlocks.

## Performance Optimization (Batch Pre-fetching Serial Numbers in RMA Receiving)
- **Problem**: In `ReceiveRMA.ts`, receiving serialized items iterated over `item.serialNumbers` and called `await this.serializedItemRepository.findBySerialOrFail` for each serial number. For RMAs with thousands of serial numbers, this resulted in an N+1 query overhead.
- **Solution**: Pre-fetch all serial numbers across all RMA item DTOs in a single batch using `this.serializedItemRepository.findBySerials(allSerials, rma.tenantId)` before entering the processing loop, storing them in an in-memory map (`preFetchedSerials`).
- **Impact**: Processing time for 5,000 serial numbers decreased from ~286.43 ms to ~35.61 ms (~87.6% latency reduction / ~8x speedup).
## 2026-03-31 - ReceiveRMA Inventory Item Pre-fetch Optimization
**Learning:** In bulk RMA receiving operations (`ReceiveRMA`), pre-fetching inventory items in batch via `findBySkus` returned records for items present in the DB, but for items not present in the DB, `preFetchedItems.get(key)` evaluated to `undefined`. This caused the application to fall back to calling `findBySku` sequentially in the loop for every missing item, leading to an N+1 query problem.
**Action:** Always track pre-fetched inventory keys (`preFetchedKeys = new Set<string>()`) during batch lookup. Inside processing loops, check `!preFetchedKeys.has(key)` before executing single-record DB fallback queries. If a key was already pre-fetched, skip the individual DB query and directly instantiate new aggregates in memory.
