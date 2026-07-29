import { PrismaClient } from "@prisma/client";
import { Logger } from "../logging/logger";
import format from "pg-format";

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
  Logger.info({ context: "RLS", message: "Setting up PostgreSQL Row-Level Security (RLS) policies..." });

  const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  for (const { table, column } of rlsTables) {
    if (!identifierRegex.test(table) || !identifierRegex.test(column)) {
      Logger.warn({ context: "RLS", message: `[RLS Setup Warning] Invalid table or column identifier. Skipping RLS setup.`, table, column });
      continue;
    }

    try {
      // 1. Enable RLS
      await prisma.$executeRawUnsafe(format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', table));
      // 2. Force RLS for table owners (Prisma connections)
      await prisma.$executeRawUnsafe(format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', table));
      // 3. Drop existing policy if it exists
      await prisma.$executeRawUnsafe(format('DROP POLICY IF EXISTS tenant_isolation ON %I;', table));
      // 4. Create policy to filter by current tenant ID
      await prisma.$executeRawUnsafe(format(`
        CREATE POLICY tenant_isolation ON %I
        USING (%I = current_setting('app.current_tenant_id', true));
      `, table, column));
      Logger.info({ context: "RLS", message: `Successfully enabled RLS on table "${table}" (column: "${column}").`, table, column });
    } catch (err: any) {
      Logger.warn({ context: "RLS", message: `[RLS Setup Warning] Could not enable RLS on table "${table}"`, table, error: err.message });
    }
  }
}
