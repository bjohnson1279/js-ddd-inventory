## Performance Insights

* **N+1 Writes in Loops:** Avoid sequential `await repository.save(item)` inside loops when processing multiple items (e.g., in `PerformFullStoreCount`). This creates significant I/O latency.
* **Optimization Strategy:** Collect items in an array and save them in batches (e.g., using Promise.all on chunks of 20 items) to execute database writes concurrently without exhausting the database connection pool or causing transaction deadlocks.
