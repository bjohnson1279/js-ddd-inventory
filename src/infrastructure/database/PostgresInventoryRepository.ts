import { Pool } from 'pg';
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { ConcurrencyException } from "../../domain/exceptions/ConcurrencyException";

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
        allocated INTEGER DEFAULT 0 NOT NULL,
        in_transit INTEGER DEFAULT 0 NOT NULL,
        version INTEGER DEFAULT 1 NOT NULL,
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
      Quantity.create(row.allocated),
      Quantity.create(row.in_transit),
      row.version,
      row.shopify_inventory_item_id
    );
  }

  async findAllBySku(sku: SKU): Promise<InventoryItem[]> {
    const res = await this.pool.query('SELECT * FROM inventory_items WHERE sku = $1', [sku.getValue()]);
    return res.rows.map(row => InventoryItem.create(
      row.id,
      SKU.create(row.sku),
      row.location_id,
      Quantity.create(row.quantity),
      Quantity.create(row.allocated),
      Quantity.create(row.in_transit),
      row.version,
      row.shopify_inventory_item_id
    ));
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
      Quantity.create(row.allocated),
      Quantity.create(row.in_transit),
      row.version,
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
      Quantity.create(row.allocated),
      Quantity.create(row.in_transit),
      row.version,
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
      Quantity.create(row.allocated),
      Quantity.create(row.in_transit),
      row.version,
      row.shopify_inventory_item_id
    ));
  }

  async save(item: InventoryItem): Promise<void> {
    const existingRes = await this.pool.query('SELECT version FROM inventory_items WHERE id = $1', [item.id]);
    if (existingRes.rows.length === 0) {
      const query = `
        INSERT INTO inventory_items (id, sku, location_id, quantity, allocated, in_transit, version, shopify_inventory_item_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      await this.pool.query(query, [
        item.id,
        item.sku.getValue(),
        item.locationId,
        item.quantity.getValue(),
        item.allocated.getValue(),
        item.inTransit.getValue(),
        item.version,
        item.shopifyInventoryItemId
      ]);
    } else {
      const query = `
        UPDATE inventory_items
        SET quantity = $1, allocated = $2, in_transit = $3, version = $4, shopify_inventory_item_id = $5
        WHERE id = $6 AND version = $7
      `;
      const res = await this.pool.query(query, [
        item.quantity.getValue(),
        item.allocated.getValue(),
        item.inTransit.getValue(),
        item.version,
        item.shopifyInventoryItemId,
        item.id,
        item.version - 1
      ]);
      if (res.rowCount === 0) {
        throw new ConcurrencyException(item.sku.getValue(), item.locationId);
      }
    }
  }

  async saveMany(items: InventoryItem[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const itemIds = items.map(item => item.id);
      let existingVersions = new Map<string, number>();

      if (itemIds.length > 0) {
        const existingRes = await client.query(
          'SELECT id, version FROM inventory_items WHERE id = ANY($1)',
          [itemIds]
        );
        for (const row of existingRes.rows) {
          existingVersions.set(row.id, row.version);
        }
      }

      const itemsToInsert: InventoryItem[] = [];
      const itemsToUpdate: InventoryItem[] = [];

      for (const item of items) {
        if (existingVersions.get(item.id) === undefined) {
          itemsToInsert.push(item);
        } else {
          itemsToUpdate.push(item);
        }
      }

      if (itemsToInsert.length > 0) {
        const insertQuery = `
          INSERT INTO inventory_items (id, sku, location_id, quantity, allocated, in_transit, version, shopify_inventory_item_id)
          SELECT * FROM UNNEST(
            $1::varchar[],
            $2::varchar[],
            $3::varchar[],
            $4::int[],
            $5::int[],
            $6::int[],
            $7::int[],
            $8::varchar[]
          )
        `;
        await client.query(insertQuery, [
          itemsToInsert.map(i => i.id),
          itemsToInsert.map(i => i.sku.getValue()),
          itemsToInsert.map(i => i.locationId),
          itemsToInsert.map(i => i.quantity.getValue()),
          itemsToInsert.map(i => i.allocated.getValue()),
          itemsToInsert.map(i => i.inTransit.getValue()),
          itemsToInsert.map(i => i.version),
          itemsToInsert.map(i => i.shopifyInventoryItemId ?? null)
        ]);
      }

      if (itemsToUpdate.length > 0) {
        const updateQuery = `
          UPDATE inventory_items AS t
          SET
            quantity = v.quantity,
            allocated = v.allocated,
            in_transit = v.in_transit,
            version = v.version,
            shopify_inventory_item_id = v.shopify_inventory_item_id
          FROM (
            SELECT * FROM UNNEST(
              $1::varchar[],
              $2::int[],
              $3::int[],
              $4::int[],
              $5::int[],
              $6::varchar[],
              $7::int[]
            ) AS t(id, quantity, allocated, in_transit, version, shopify_inventory_item_id, expected_version)
          ) AS v
          WHERE t.id = v.id AND t.version = v.expected_version
          RETURNING t.id
        `;
        const res = await client.query(updateQuery, [
          itemsToUpdate.map(i => i.id),
          itemsToUpdate.map(i => i.quantity.getValue()),
          itemsToUpdate.map(i => i.allocated.getValue()),
          itemsToUpdate.map(i => i.inTransit.getValue()),
          itemsToUpdate.map(i => i.version),
          itemsToUpdate.map(i => i.shopifyInventoryItemId ?? null),
          itemsToUpdate.map(i => i.version - 1)
        ]);

        if (res.rowCount !== itemsToUpdate.length) {
          const updatedIds = new Set((res.rows || []).map((r: any) => r.id));
          const failedItem = itemsToUpdate.find(i => !updatedIds.has(i.id)) || itemsToUpdate[0];
          throw new ConcurrencyException(failedItem.sku.getValue(), failedItem.locationId);
        }
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
