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
  // 1. GraphQL DB (port 5433)
  console.log("Applying RLS & Continuous Aggregate on GraphQL DB...");
  const gqlConfig = { connectionString: "postgresql://inventory_user:inventory_password@127.0.0.1:5433/inventory_db?schema=public" };
  const gqlQueries = [
    // Disable RLS on the raw hypertable to allow background materialization
    `ALTER TABLE ledger_entries DISABLE ROW LEVEL SECURITY;`,

    // Create the continuous aggregate
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

    // Enable RLS on the materialized view itself to secure aggregated reads
    `ALTER MATERIALIZED VIEW daily_stock_velocity ENABLE ROW LEVEL SECURITY;`,
    `DROP POLICY IF EXISTS tenant_isolation ON daily_stock_velocity;`,
    `CREATE POLICY tenant_isolation ON daily_stock_velocity USING (tenant_id = current_setting('app.current_tenant_id', true));`,

    // Add continuous aggregate policy to update the view automatically in background
    `SELECT add_continuous_aggregate_policy('daily_stock_velocity',
       start_offset => INTERVAL '1 month',
       end_offset => INTERVAL '1 hour',
       schedule_interval => INTERVAL '1 hour',
       if_not_exists => TRUE);`
  ];
  await runSql(gqlConfig, gqlQueries);
  console.log("GraphQL DB RLS & Continuous Aggregate applied successfully!");

  // 2. Laravel DB (port 5436)
  console.log("\nApplying RLS & Continuous Aggregate on Laravel DB...");
  const laravelConfig = { connectionString: "postgresql://ddd_user:secret@127.0.0.1:5436/ddd_inventory?schema=public" };
  const laravelQueries = [
    // Disable RLS on the raw hypertable to allow background materialization
    `ALTER TABLE ledger_entries DISABLE ROW LEVEL SECURITY;`,

    // Create the continuous aggregate
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

    // Enable RLS on the materialized view itself to secure aggregated reads
    `ALTER MATERIALIZED VIEW daily_stock_velocity ENABLE ROW LEVEL SECURITY;`,
    `DROP POLICY IF EXISTS tenant_isolation ON daily_stock_velocity;`,
    `CREATE POLICY tenant_isolation ON daily_stock_velocity USING (tenant_id = current_setting('app.current_tenant_id', true));`,

    // Add continuous aggregate policy to update the view automatically in background
    `SELECT add_continuous_aggregate_policy('daily_stock_velocity',
       start_offset => INTERVAL '1 month',
       end_offset => INTERVAL '1 hour',
       schedule_interval => INTERVAL '1 hour',
       if_not_exists => TRUE);`
  ];
  await runSql(laravelConfig, laravelQueries);
  console.log("Laravel DB RLS & Continuous Aggregate applied successfully!");

  // 3. Express DB (port 5432)
  console.log("\nApplying RLS & Continuous Aggregate on Express DB...");
  const expressConfig = { connectionString: "postgresql://postgres:password@127.0.0.1:5432/inventory?schema=public" };
  const expressQueries = [
    `CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`,
    `SELECT create_hypertable('dispatch_records', 'dispatched_at', if_not_exists => TRUE);`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS daily_dispatch_summary
     WITH (timescaledb.continuous) AS
     SELECT 
       time_bucket('1 day', dispatched_at) AS bucket,
       sku,
       "locationId",
       sum(quantity) as total_dispatched,
       count(*) as dispatch_count
     FROM dispatch_records
     GROUP BY bucket, sku, "locationId";`,

    `SELECT add_continuous_aggregate_policy('daily_dispatch_summary',
       start_offset => INTERVAL '1 month',
       end_offset => INTERVAL '1 hour',
       schedule_interval => INTERVAL '1 hour',
       if_not_exists => TRUE);`
  ];
  await runSql(expressConfig, expressQueries);
  console.log("Express DB RLS & Continuous Aggregate applied successfully!");
}

main().catch(console.error);
