1. **Identify the optimization opportunity:**
   - Review `src/domain/services/AuditProcessorService.ts`.
   - Identified N+1 queries in the `runAudit` method:
     - `prisma.inventoryModel.aggregate` was being called in a loop for each product variant to sum up local quantities.
     - `prisma.quickbooksJournalMappingModel.findUnique`, `xeroJournalMappingModel.findUnique`, and `netsuiteJournalMappingModel.findUnique` were being queried for each journal entry sequentially.
     - `prisma.auditDiscrepancyModel.findFirst` was called inside loops for both Shopify mismatch audits and accounting audits.

2. **Implement the optimization (Already done):**
   - Replaced loop-based aggregation with a single `prisma.inventoryModel.groupBy` query to pre-compute local quantities for all SKUs and mapped them in an O(1) `Map`.
   - Pre-fetched all relevant journal mappings across all services (Quickbooks, Xero, Netsuite) in parallel using `Promise.all` with a single `findMany` using `in` queries, mapping the IDs to O(1) `Set` lookups.
   - Replaced the loop-based `findFirst` checks for existing discrepancies with a single pre-fetch query using `findMany` and filtering with a `Set`.
   - Replaced multiple sequential `.create()` statements inside loops with bulk-insert batch arrays calling `.createMany()`.

3. **Verify tests (Already done):**
   - Adjusted `tests/infrastructure/http/AuditE2E.test.ts` to mock the newly introduced Prisma methods (`groupBy`, `findMany` for mappings, `createMany`).
   - Confirmed tests pass with the new data fetching pattern using `npm run test` against the real Postgres schema initialized in CI/Docker mock context.

4. **Add learning to journal (Already done):**
   - Wrote to `.jules/bolt.md` documenting the strategy to resolve $O(N)$ DB queries and $O(N \times M)$ bottlenecks specific to Prisma aggregates in the audit loop.

5. **Final pre-commit check and Submission:**
   - Execute the `pre_commit_instructions` tool to make sure all verification is formally sound.
   - Create a PR via `submit` using the title `⚡ Bolt: [performance improvement]`.
   - Structure the PR description to cover 💡 **What**, 🎯 **Why**, 📊 **Impact**, and 🔬 **Measurement**.
