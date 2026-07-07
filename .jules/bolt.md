## 2024-07-07 - [Optimize N+1 queries in demand planning]
**Learning:** `GetDemandPlanningReport` had an N+1 query vulnerability because it iterated over inventory items and called `CalculateSalesVelocity`, which internally triggered a redundant database query to fetch the same stock value.
**Action:** Pass the already fetched inventory item's quantity as an optional parameter (`preFetchedStock`) down to `CalculateSalesVelocity.execute()` to prevent redundant lookups.
