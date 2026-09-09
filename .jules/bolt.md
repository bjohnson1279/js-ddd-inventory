## 2024-03-24 - GetDemandPlanningReport N+1 Query Optimization
**Learning:** Sequential map/await loops over inventory items that fetch independent data (like dispatch history) for each item can cause severe N+1 query bottlenecks in reporting use cases.
**Action:** Always prefer fetching related data for the entire set of locations/items upfront into an in-memory Map (using a bulk method like \`fetchHistoryByLocation\`), and then distribute it downstream during the loop to achieve O(1) performance inside loops instead of O(N).
## 2024-05-24 - Prevent N+1 queries in evaluatePolicies
**Learning:** Found an N+1 query issue in evaluatePolicies where all purchase orders were fetched in every loop iteration.
**Action:** Pulled the poRepository.findAll() query out of the for-loop to run once, making the process O(1) in DB lookups instead of O(N) where N is the number of policies.
