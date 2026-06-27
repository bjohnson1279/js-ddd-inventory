const { Client } = require('pg');

async function runSql(clientConfig, queries) {
  const client = new Client(clientConfig);
  await client.connect();
  for (const sql of queries) {
    try {
      await client.query(sql);
    } catch (err) {
      console.error(`Error executing query: "${sql.trim()}"\nError:`, err.message);
    }
  }
  await client.end();
}

async function main() {
  // 1. Express DB (port 5432)
  console.log("Setting up Express DB RLS & Continuous Aggregates...");
  const expressConfig = { connectionString: "postgresql://postgres:password@127.0.0.1:5432/inventory?schema=public" };
  const expressTables = [
    'ApiTokenModel',
    'InventoryAuditModel',
    'InventoryCostLayerModel',
    'JournalEntryModel',
    'NotificationModel',
    'PurchaseOrderModel',
    'QuarantineItemModel',
    'RMAModel',
    'SerializedItemModel',
    'TenantConfigModel'
  ];
  const expressQueries = [
    `CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`
  ];
  // Apply RLS to Express tables
  for (const table of expressTables) {
    expressQueries.push(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    expressQueries.push(`DROP POLICY IF EXISTS tenant_isolation ON "${table}";`);
    expressQueries.push(`CREATE POLICY tenant_isolation ON "${table}" USING ("tenantId" = current_setting('app.current_tenant_id', true));`);
  }
  // UserModel specific policy
  expressQueries.push(`ALTER TABLE "UserModel" ENABLE ROW LEVEL SECURITY;`);
  expressQueries.push(`DROP POLICY IF EXISTS user_select ON "UserModel";`);
  expressQueries.push(`DROP POLICY IF EXISTS user_modify ON "UserModel";`);
  expressQueries.push(`CREATE POLICY user_select ON "UserModel" FOR SELECT USING (true);`);
  expressQueries.push(`CREATE POLICY user_modify ON "UserModel" FOR ALL USING ("tenantId" = current_setting('app.current_tenant_id', true));`);

  // Hypertable & Continuous Aggregate for Express
  expressQueries.push(`SELECT create_hypertable('dispatch_records', 'dispatched_at', if_not_exists => TRUE);`);
  expressQueries.push(`CREATE MATERIALIZED VIEW IF NOT EXISTS daily_dispatch_summary
     WITH (timescaledb.continuous) AS
     SELECT 
       time_bucket('1 day', dispatched_at) AS bucket,
       sku,
       "locationId",
       sum(quantity) as total_dispatched,
       count(*) as dispatch_count
     FROM dispatch_records
     GROUP BY bucket, sku, "locationId";`);
  expressQueries.push(`SELECT add_continuous_aggregate_policy('daily_dispatch_summary',
       start_offset => INTERVAL '1 month',
       end_offset => INTERVAL '1 hour',
       schedule_interval => INTERVAL '1 hour',
       if_not_exists => TRUE);`);

  await runSql(expressConfig, expressQueries);
  console.log("Express DB setup complete!");

  // 2. GraphQL DB (port 5433)
  console.log("\nSetting up GraphQL DB Continuous Aggregates...");
  const gqlConfig = { connectionString: "postgresql://inventory_user:inventory_password@127.0.0.1:5433/inventory_db?schema=public" };
  const gqlQueries = [
    // Disable RLS on raw hypertable to allow background aggregate access
    `ALTER TABLE ledger_entries DISABLE ROW LEVEL SECURITY;`,

    // Create continuous aggregate
    `CREATE MATERIALIZED VIEW IF NOT EXISTS daily_stock_velocity
     WITH (timescaledb.continuous) AS
     SELECT 
       time_bucket('1 day', occurred_at) AS bucket,
       tenant_id,
       variant_id,
       COALESCE(SUM(CASE WHEN quantity < 0 THEN abs(quantity) ELSE 0 END), 0) AS units_dispatched,
       COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0) AS units_received,
       COUNT(*) as transaction_count
     FROM ledger_entries
     GROUP BY bucket, tenant_id, variant_id;`,

    // Add continuous aggregate policy
    `SELECT add_continuous_aggregate_policy('daily_stock_velocity',
       start_offset => INTERVAL '1 month',
       end_offset => INTERVAL '1 hour',
       schedule_interval => INTERVAL '1 hour',
       if_not_exists => TRUE);`,

    // Create secure tenant-filtered SQL view
    `CREATE OR REPLACE VIEW stock_velocity_report AS
     SELECT bucket, tenant_id, variant_id, units_dispatched, units_received, transaction_count
     FROM daily_stock_velocity
     WHERE tenant_id = current_setting('app.current_tenant_id', true);`
  ];
  await runSql(gqlConfig, gqlQueries);
  console.log("GraphQL DB setup complete!");

  // 3. Laravel DB (port 5436)
  console.log("\nSetting up Laravel DB Continuous Aggregates...");
  const laravelConfig = { connectionString: "postgresql://ddd_user:secret@127.0.0.1:5436/ddd_inventory?schema=public" };
  const laravelQueries = [
    // Disable RLS on raw hypertable to allow background aggregate access
    `ALTER TABLE ledger_entries DISABLE ROW LEVEL SECURITY;`,

    // Create continuous aggregate
    `CREATE MATERIALIZED VIEW IF NOT EXISTS daily_stock_velocity
     WITH (timescaledb.continuous) AS
     SELECT 
       time_bucket('1 day', occurred_at) AS bucket,
       tenant_id,
       variant_id,
       COALESCE(SUM(CASE WHEN quantity < 0 THEN abs(quantity) ELSE 0 END), 0) AS units_dispatched,
       COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0) AS units_received,
       COUNT(*) as transaction_count
     FROM ledger_entries
     GROUP BY bucket, tenant_id, variant_id;`,

    // Add continuous aggregate policy
    `SELECT add_continuous_aggregate_policy('daily_stock_velocity',
       start_offset => INTERVAL '1 month',
       end_offset => INTERVAL '1 hour',
       schedule_interval => INTERVAL '1 hour',
       if_not_exists => TRUE);`,

    // Create secure tenant-filtered SQL view
    `CREATE OR REPLACE VIEW stock_velocity_report AS
     SELECT bucket, tenant_id, variant_id, units_dispatched, units_received, transaction_count
     FROM daily_stock_velocity
     WHERE tenant_id = current_setting('app.current_tenant_id', true);`
  ];
  await runSql(laravelConfig, laravelQueries);
  console.log("Laravel DB setup complete!");
}

main().catch(console.error);
