## 2024-05-18 - Optimize Kit Sale Concurrent Fetch
**Learning:** Sequential database fetches inside a loop when calculating multi-component bundle adjustments (`decrementForKitSale`) can cause unnecessary N+1 style DB load (2N fetches per kit sale).
**Action:** Always fetch dependency constraints upfront concurrently with `Promise.all` mapping over the array to minimize database queries.
- Avoid sequential database operations inside loops. Fetch dependencies upfront concurrently using `Promise.all` to minimize query bottlenecks and optimize overall latency.
