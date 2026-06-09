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
        sku VARCHAR(255) NOT NULL,
        location_id VARCHAR(255) DEFAULT 'default' NOT NULL,
        quantity INTEGER NOT NULL,
        shopify_inventory_item_id VARCHAR(255),
        UNIQUE(sku, location_id)
      );
    `;
    await this.pool.query(query);
  }

  async findBySku(sku: SKU, locationId?: string): Promise<InventoryItem | null> {
    let res;
    if (locationId) {
      res = await this.pool.query('SELECT * FROM inventory_items WHERE sku = $1 AND location_id = $2', [sku.getValue(), locationId]);
    } else {
      res = await this.pool.query('SELECT * FROM inventory_items WHERE sku = $1 LIMIT 1', [sku.getValue()]);
    }
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    return InventoryItem.create(
      row.id,
      sku,
      row.location_id,
      Quantity.create(row.quantity),
      row.shopify_inventory_item_id
    );
  }

  async findBySkus(skus: SKU[], locationId: string = "default"): Promise<InventoryItem[]> {
    const skuValues = skus.map(s => s.getValue());
    const res = await this.pool.query(
      'SELECT * FROM inventory_items WHERE sku = ANY($1) AND location_id = $2',
      [skuValues, locationId]
    );
    return res.rows.map(row => InventoryItem.create(
      row.id,
      SKU.create(row.sku),
      row.location_id,
      Quantity.create(row.quantity),
      row.shopify_inventory_item_id
    ));
  }

  async findAll(): Promise<InventoryItem[]> {
    const res = await this.pool.query('SELECT * FROM inventory_items');
    return res.rows.map(row => InventoryItem.create(
      row.id,
      SKU.create(row.sku),
      row.location_id,
      Quantity.create(row.quantity),
      row.shopify_inventory_item_id
    ));
  }

  async findAllByLocation(locationId: string): Promise<InventoryItem[]> {
    const res = await this.pool.query('SELECT * FROM inventory_items WHERE location_id = $1', [locationId]);
    return res.rows.map(row => InventoryItem.create(
      row.id,
      SKU.create(row.sku),
      row.location_id,
      Quantity.create(row.quantity),
      row.shopify_inventory_item_id
    ));
  }

  async save(item: InventoryItem): Promise<void> {
    const query = `
      INSERT INTO inventory_items (id, sku, location_id, quantity, shopify_inventory_item_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (sku, location_id) DO UPDATE SET
        quantity = EXCLUDED.quantity,
        shopify_inventory_item_id = EXCLUDED.shopify_inventory_item_id;
    `;
    await this.pool.query(query, [
      item.id,
      item.sku.getValue(),
      item.locationId,
      item.quantity.getValue(),
      item.shopifyInventoryItemId
    ]);
  }

  async saveMany(items: InventoryItem[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const query = `
        INSERT INTO inventory_items (id, sku, location_id, quantity, shopify_inventory_item_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (sku, location_id) DO UPDATE SET
          quantity = EXCLUDED.quantity,
          shopify_inventory_item_id = EXCLUDED.shopify_inventory_item_id;
      `;
      for (const item of items) {
        await client.query(query, [
          item.id,
          item.sku.getValue(),
          item.locationId,
          item.quantity.getValue(),
          item.shopifyInventoryItemId
        ]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async hasAnyEntries(variantId: string, locationId: string): Promise<boolean> {
    const res = await this.pool.query('SELECT 1 FROM inventory_items WHERE sku = $1 AND location_id = $2 LIMIT 1', [variantId, locationId]);
    return res.rows.length > 0;
  }
}
