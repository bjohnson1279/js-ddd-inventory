import { ReceiveStock } from '../../../src/application/useCases/ReceiveStock';
import { DispatchStock } from '../../../src/application/useCases/DispatchStock';
import { InventoryItem } from '../../../src/domain/aggregates/InventoryItem';
import { InventoryCostLayer } from '../../../src/domain/accounting/entities/InventoryCostLayer';
import { SKU } from '../../../src/domain/valueObjects/SKU';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';

function fixture() {
  const item = InventoryItem.create('stock-1', SKU.create('MILK'), 'cold-room', Quantity.create(10));
  const inventory = { findBySku: jest.fn().mockResolvedValue(item), save: jest.fn() };
  const publisher = { publishStockLevel: jest.fn() };
  const product = { findVariantBySku: jest.fn().mockReturnValue({ id: 'variant-1' }) };
  const products = { findBySku: jest.fn().mockResolvedValue(product) };
  const costs = { save: jest.fn(), saveMany: jest.fn(), getActiveLayers: jest.fn().mockResolvedValue([]) };
  const records = { save: jest.fn() };
  const capacity = { validateCapacity: jest.fn() };
  const reorder = { checkPolicy: jest.fn() };
  const layer = (id: string, quantity: number, lot = 'lot-a') => new InventoryCostLayer(id, 'variant-1', 'store-a', quantity, 125, new Date('2026-01-01'), 'PO-1', 'cold-room', lot);
  return { item, inventory, publisher, product, products, costs, records, capacity, reorder, layer,
    receive: () => new ReceiveStock(inventory as any, publisher, capacity as any, products as any, costs as any),
    dispatch: () => new DispatchStock(inventory as any, publisher, reorder as any, records as any, products as any, costs as any) };
}

describe('stock receipt costing and rejection paths', () => {
  it('persists exact receipt cost, tenant, purchase order, location and lot metadata', async () => {
    const f = fixture(); const expiry = new Date('2027-01-01');
    await f.receive().execute('MILK', 4, 'cold-room', 125, 'lot-a', expiry, 'store-a', 'PO-42');
    expect(f.capacity.validateCapacity).toHaveBeenCalledWith('cold-room', [{ sku: 'MILK', mode: 'relative', quantity: 4 }]);
    expect(f.costs.save).toHaveBeenCalledWith(expect.objectContaining({ variantId: 'variant-1', tenantId: 'store-a', originalQuantity: 4,
      remainingQuantity: 4, unitCostCents: 125, purchaseOrderId: 'PO-42', locationId: 'cold-room', lotNumber: 'lot-a', expirationDate: expiry }));
    expect(f.item.quantity.getValue()).toBe(14);
    expect(f.publisher.publishStockLevel).toHaveBeenCalledWith(expect.any(SKU), Quantity.create(14));
  });
  it('records a zero-cost direct receipt rather than dropping its layer', async () => {
    const f = fixture(); await f.receive().execute('MILK', 1, 'cold-room', 0);
    expect(f.costs.save).toHaveBeenCalledWith(expect.objectContaining({ unitCostCents: 0, purchaseOrderId: 'DIRECT-RECEIPT' }));
  });
  it('does not create an invented cost layer when the receipt is unpriced', async () => {
    const f = fixture(); await f.receive().execute('MILK', 2, 'cold-room');
    expect(f.products.findBySku).not.toHaveBeenCalled(); expect(f.costs.save).not.toHaveBeenCalled();
    expect(f.item.quantity.getValue()).toBe(12);
  });
  it('leaves inventory unchanged when capacity validation rejects the receipt', async () => {
    const f = fixture(); f.capacity.validateCapacity.mockRejectedValue(new Error('Capacity exceeded'));
    await expect(f.receive().execute('MILK', 4, 'cold-room', 125)).rejects.toThrow('Capacity exceeded');
    expect(f.item.quantity.getValue()).toBe(10); expect(f.inventory.save).not.toHaveBeenCalled();
    expect(f.costs.save).not.toHaveBeenCalled(); expect(f.publisher.publishStockLevel).not.toHaveBeenCalled();
  });
  it.each(['product', 'variant'])('rejects a missing %s before changing stock', async missing => {
    const f = fixture(); if (missing === 'product') f.products.findBySku.mockResolvedValue(null); else f.product.findVariantBySku.mockReturnValue(null as any);
    await expect(f.receive().execute('MILK', 4, 'cold-room', 125)).rejects.toThrow(/not found/);
    expect(f.item.quantity.getValue()).toBe(10); expect(f.inventory.save).not.toHaveBeenCalled();
    expect(f.costs.save).not.toHaveBeenCalled(); expect(f.publisher.publishStockLevel).not.toHaveBeenCalled();
  });
  it('propagates stock persistence errors without publishing a layer or external update', async () => {
    const f = fixture(); f.inventory.save.mockRejectedValue(new Error('Concurrent modification'));
    await expect(f.receive().execute('MILK', 4, 'cold-room', 125)).rejects.toThrow('Concurrent modification');
    expect(f.costs.save).not.toHaveBeenCalled(); expect(f.publisher.publishStockLevel).not.toHaveBeenCalled();
  });
});

describe('stock dispatch costing and rejection paths', () => {
  it('consumes only the requested lot and records the consumed quantities', async () => {
    const f = fixture(); const other = f.layer('other', 8, 'lot-b'); const first = f.layer('first', 2); const second = f.layer('second', 5);
    f.costs.getActiveLayers.mockResolvedValue([other, first, second]);
    await f.dispatch().execute('MILK', 4, 'cold-room', false, 'lot-a');
    expect(f.costs.getActiveLayers).toHaveBeenCalledWith('variant-1', 'expiration_date ASC');
    expect(other.remainingQuantity).toBe(8); expect(first.remainingQuantity).toBe(0); expect(second.remainingQuantity).toBe(3);
    expect(f.item.quantity.getValue()).toBe(6);
    expect(f.records.save.mock.calls.map(([record]) => [record.quantity, record.lotNumber])).toEqual([[2, 'lot-a'], [2, 'lot-a']]);
    expect(f.costs.saveMany).toHaveBeenCalledWith([other, first, second]);
    expect(f.reorder.checkPolicy).toHaveBeenCalledWith('MILK', 'cold-room', 6);
  });
  it('rejects an insufficient selected lot before changing stock, layers or records', async () => {
    const f = fixture(); const selected = f.layer('selected', 2); const other = f.layer('other', 8, 'lot-b');
    f.costs.getActiveLayers.mockResolvedValue([selected, other]);
    await expect(f.dispatch().execute('MILK', 4, 'cold-room', false, 'lot-a')).rejects.toThrow('Insufficient stock in lot lot-a');
    expect(f.item.quantity.getValue()).toBe(10); expect(selected.remainingQuantity).toBe(2); expect(other.remainingQuantity).toBe(8);
    for (const fn of [f.inventory.save, f.costs.saveMany, f.records.save, f.publisher.publishStockLevel, f.reorder.checkPolicy]) expect(fn).not.toHaveBeenCalled();
  });
  it('stops consuming layers once the dispatch quantity is satisfied', async () => {
    const f = fixture(); const first = f.layer('first', 5); const next = f.layer('next', 5);
    f.costs.getActiveLayers.mockResolvedValue([first, next]);
    await f.dispatch().execute('MILK', 3, 'cold-room', true);
    expect(first.remainingQuantity).toBe(2); expect(next.remainingQuantity).toBe(5);
    expect(f.records.save).toHaveBeenCalledTimes(1); expect(f.publisher.publishStockLevel).not.toHaveBeenCalled();
  });
  it('does not consume cost layers when stock persistence reports a conflict', async () => {
    const f = fixture(); const layer = f.layer('first', 10); f.costs.getActiveLayers.mockResolvedValue([layer]);
    f.inventory.save.mockRejectedValue(new Error('Concurrent modification'));
    await expect(f.dispatch().execute('MILK', 2, 'cold-room')).rejects.toThrow('Concurrent modification');
    expect(layer.remainingQuantity).toBe(10); expect(f.costs.saveMany).not.toHaveBeenCalled(); expect(f.records.save).not.toHaveBeenCalled();
    expect(f.publisher.publishStockLevel).not.toHaveBeenCalled();
  });
  it('does not change inventory when reading cost layers fails', async () => {
    const f = fixture(); f.costs.getActiveLayers.mockRejectedValue(new Error('Cost storage unavailable'));
    await expect(f.dispatch().execute('MILK', 2, 'cold-room', false, 'lot-a')).rejects.toThrow('Cost storage unavailable');
    expect(f.item.quantity.getValue()).toBe(10); expect(f.inventory.save).not.toHaveBeenCalled();
    expect(f.records.save).not.toHaveBeenCalled(); expect(f.publisher.publishStockLevel).not.toHaveBeenCalled();
  });
  it('records an uncosted dispatch when costing repositories are not configured', async () => {
    const f = fixture(); const dispatch = new DispatchStock(f.inventory as any, undefined, f.reorder as any, f.records as any);
    await dispatch.execute('MILK', 2, 'cold-room', false, 'lot-a');
    expect(f.records.save).toHaveBeenCalledWith(expect.objectContaining({ sku: 'MILK', quantity: 2, lotNumber: 'lot-a' }));
    expect(f.reorder.checkPolicy).toHaveBeenCalledWith('MILK', 'cold-room', 8);
  });
});
