import { Logger } from "../logging/logger";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const user = process.env.DB_USER || 'postgres';
const password = process.env.DB_PASSWORD;
const auth = password ? `${user}:${password}` : user;
const host = process.env.DB_HOST || '127.0.0.1';
const port = process.env.DB_PORT || '5432';
const dbName = process.env.DB_NAME || 'inventory';

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${auth}@${host}:${port}/${dbName}?schema=public`;

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
            await basePrisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, false)`;
          } catch (err: any) {
            Logger.error({ context: "PrismaExtension", message: "Failed to set app.current_tenant_id" }, err);
          }
        }
        return query(args);
      }
    }
  }
}) as unknown as typeof basePrisma;
