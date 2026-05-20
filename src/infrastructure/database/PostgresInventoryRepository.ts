import { Pool } from 'pg';
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";

export class PostgresInventoryRepository implements IInventoryRepository {
  private pool: Pool;

  constructor(config: any) {
    this.pool = new Pool(config);
  }

  async initialize(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS inventory_items (
        id VARCHAR(255) PRIMARY KEY,
        sku VARCHAR(255) UNIQUE NOT NULL,
        quantity INTEGER NOT NULL,
        shopify_inventory_item_id VARCHAR(255)
      );
    `;
    await this.pool.query(query);
  }

  async findBySku(sku: SKU): Promise<InventoryItem | null> {
    const res = await this.pool.query('SELECT * FROM inventory_items WHERE sku = $1', [sku.getValue()]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    return InventoryItem.create(
      row.id,
      sku,
      Quantity.create(row.quantity),
      row.shopify_inventory_item_id
    );
  }

  async findAll(): Promise<InventoryItem[]> {
    const res = await this.pool.query('SELECT * FROM inventory_items');
    return res.rows.map(row => InventoryItem.create(
      row.id,
      SKU.create(row.sku),
      Quantity.create(row.quantity),
      row.shopify_inventory_item_id
    ));
  }

  async save(item: InventoryItem): Promise<void> {
    const query = `
      INSERT INTO inventory_items (id, sku, quantity, shopify_inventory_item_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (sku) DO UPDATE SET
        quantity = EXCLUDED.quantity,
        shopify_inventory_item_id = EXCLUDED.shopify_inventory_item_id;
    `;
    await this.pool.query(query, [
      item.id,
      item.sku.getValue(),
      item.quantity.getValue(),
      item.shopifyInventoryItemId
    ]);
  }

  async hasAnyEntries(variantId: string, locationId: string): Promise<boolean> {
    // Note: For now, we use variantId as SKU in our simplified implementation
    const res = await this.pool.query('SELECT 1 FROM inventory_items WHERE sku = $1 LIMIT 1', [variantId]);
    return res.rows.length > 0;
  }
}
