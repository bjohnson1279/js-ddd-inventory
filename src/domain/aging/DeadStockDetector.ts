export class DeadStockDetector {
  /**
   * Identifies SKUs that have not moved (no dispatches) within the analysis period.
   * @param inventorySkus List of all SKUs currently in stock
   * @param dispatches List of dispatch records for the period
   */
  public identifyDeadStock(inventorySkus: string[], dispatches: any[]): string[] {
    const dispatchedSkus = new Set(dispatches.map(d => d.sku));
    
    // Dead stock = SKUs in inventory that are NOT in the dispatched set
    return inventorySkus.filter(sku => !dispatchedSkus.has(sku));
  }
}
