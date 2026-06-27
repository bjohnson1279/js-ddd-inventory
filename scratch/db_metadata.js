const { Client } = require('pg');

async function main() {
  // Express DB (port 5432)
  console.log("--- Express DB Columns ---");
  const expressClient = new Client({
    connectionString: "postgresql://postgres:password@127.0.0.1:5432/inventory?schema=public"
  });
  await expressClient.connect();
  const expressRes = await expressClient.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND column_name ILIKE '%tenant%'
    ORDER BY table_name;
  `);
  console.log(JSON.stringify(expressRes.rows, null, 2));
  await expressClient.end();

  // GraphQL DB (port 5433)
  console.log("\n--- GraphQL DB Columns ---");
  const gqlClient = new Client({
    connectionString: "postgresql://inventory_user:inventory_password@127.0.0.1:5433/inventory_db?schema=public"
  });
  await gqlClient.connect();
  const gqlRes = await gqlClient.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND column_name ILIKE '%tenant%'
    ORDER BY table_name;
  `);
  console.log(JSON.stringify(gqlRes.rows, null, 2));
  await gqlClient.end();

  // Laravel DB (port 5436)
  console.log("\n--- Laravel DB Columns ---");
  const laravelClient = new Client({
    connectionString: "postgresql://ddd_user:secret@127.0.0.1:5436/ddd_inventory?schema=public"
  });
  await laravelClient.connect();
  const laravelRes = await laravelClient.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND column_name ILIKE '%tenant%'
    ORDER BY table_name;
  `);
  console.log(JSON.stringify(laravelRes.rows, null, 2));
  await laravelClient.end();
}

main().catch(console.error);
