import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'password'}@${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'inventory'}?schema=public`;

import { tenantLocalStorage } from "./tenantContext";

export const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const basePrisma = new PrismaClient({ adapter } as any);

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const tenantId = tenantLocalStorage.getStore();
        if (tenantId && process.env.NODE_ENV !== "test") {
          try {
            await basePrisma.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, false)`, tenantId);
          } catch (err: any) {
            console.error("[PrismaExtension] Failed to set app.current_tenant_id:", err.message);
          }
        }
        return query(args);
      }
    }
  }
}) as unknown as typeof basePrisma;
