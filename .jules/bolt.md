## 2024-05-18 - Optimize Kit Sale Concurrent Fetch
**Learning:** Sequential database fetches inside a loop when calculating multi-component bundle adjustments (`decrementForKitSale`) can cause unnecessary N+1 style DB load (2N fetches per kit sale).
**Action:** Always fetch dependency constraints upfront concurrently with `Promise.all` mapping over the array to minimize database queries.
## 2024-05-18 - Optimize OpeningBalanceService Concurrent Fetch
**Learning:** Sequential database fetches inside a loop when processing stock onboardings (`hasAnyEntries` and `findBySku`) can cause unnecessary N+1 style DB load (2N fetches per onboarding request).
**Action:** Always fetch dependency constraints upfront concurrently with `Promise.all` mapping over the array to minimize database queries before doing state changes.
