## 2026-07-04 - [AuditProcessorService Optimize]
**Learning:** Found N+1 queries in AuditProcessorService.ts when fetching external accounting journal mappings inside a loop, and aggregating inventory models.
**Action:** Pre-fetched data using `groupBy` and `findMany` using `in` clause to do it in O(1) inside loop to resolve N+1 queries. Used Set for O(1) mapping verification inside the loop instead of multiple sequential `findUnique` operations.
