import { PrismaClient } from "@prisma/client";

export const rlsTables = [
  { table: "SerializedItemModel", column: "tenantId" },
  { table: "InventoryCostLayerModel", column: "tenantId" },
  { table: "JournalEntryModel", column: "tenantId" },
  { table: "TenantConfigModel", column: "tenantId" },
  { table: "PurchaseOrderModel", column: "tenantId" },
  { table: "InventoryAuditModel", column: "tenantId" },
  { table: "RMAModel", column: "tenantId" },
  { table: "QuarantineItemModel", column: "tenantId" },
  { table: "UserModel", column: "tenantId" },
  { table: "ApiTokenModel", column: "tenantId" },
  { table: "NotificationModel", column: "tenantId" },
  { table: "audit_discrepancies", column: "tenant_id" },
];

export async function enableRowLevelSecurity(prisma: PrismaClient): Promise<void> {
  console.log("Setting up PostgreSQL Row-Level Security (RLS) policies...");
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
      console.log(`Successfully enabled RLS on table "${table}" (column: "${column}").`);
    } catch (err: any) {
      console.log(`[RLS Setup Warning] Could not enable RLS on table "${table}":`, err.message);
    }
  }
}
