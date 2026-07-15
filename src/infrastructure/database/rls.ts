import { PrismaClient } from "@prisma/client";
import { Logger } from "../logging/logger";

export const rlsTables = [
  { table: "inventory_items", column: "tenantId" },
  { table: "barcodes", column: "tenantId" },
  { table: "serialized_items", column: "tenantId" },
  { table: "inventory_cost_layers", column: "tenantId" },
  { table: "journal_entries", column: "tenantId" },
  { table: "tenant_configs", column: "tenantId" },
  { table: "purchase_orders", column: "tenantId" },
  { table: "inventory_audits", column: "tenantId" },
  { table: "rmas", column: "tenantId" },
  { table: "quarantine_items", column: "tenantId" },
  { table: "users", column: "tenantId" },
  { table: "api_tokens", column: "tenantId" },
  { table: "notifications", column: "tenantId" },
  { table: "audit_discrepancies", column: "tenant_id" },
];

export async function enableRowLevelSecurity(prisma: PrismaClient): Promise<void> {
  Logger.info({ context: "Database", message: "Setting up PostgreSQL Row-Level Security (RLS) policies..." });
  for (const { table, column } of rlsTables) {
    try {
      // 1. Enable RLS
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      // 2. Force RLS for table owners (Prisma connections)
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
      // 3. Drop existing policy if it exists
      await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS tenant_isolation ON "${table}";`);
      // 4. Create policy to filter by current tenant ID
      await prisma.$executeRawUnsafe(`
        CREATE POLICY tenant_isolation ON "${table}"
        USING ("${column}" = current_setting('app.current_tenant_id', true));
      `);
      Logger.info({ context: "Database", message: `Successfully enabled RLS on table "${table}" (column: "${column}").` });
    } catch (err: any) {
      Logger.error({ context: "Database", message: `[RLS Setup Warning] Could not enable RLS on table "${table}"` }, err);
    }
  }
}
