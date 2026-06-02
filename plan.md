1. **Remove redundant database queries in InventoryService:**
   - Modify `decrementForSale` to fetch the item once and use it for validation instead of calling `assertSufficientStock`.
   - Modify `decrementForKitSale` to fetch items once in pass 1, store them in a Map, and reuse them in pass 2.
   - Remove the `assertSufficientStock` private method, as it leads to an N+1 fetching anti-pattern.
2. **Verify tests:**
   - Run the Jest tests to ensure everything works correctly.
3. **Pre-commit tasks:**
   - Run pre-commit instructions for quality checks.
4. **Submit PR:**
   - Commit and submit changes with a performance-focused PR.
