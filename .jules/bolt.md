## Performance Insights

* **N+1 Writes in Loops:** Avoid sequential `await repository.save(item)` inside loops when processing multiple items (e.g., in `PerformFullStoreCount`). This creates significant I/O latency.
* **Optimization Strategy:** Collect promises in an array (`const savePromises = []`) and use `await Promise.all(savePromises)` at the end of the operation to execute database writes concurrently. This reduces execution time from ~340ms to ~36ms for 100 items.
