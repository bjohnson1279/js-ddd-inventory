import { Prisma } from "@prisma/client";

const prisma = new (require("prisma").PClient)();
export const basePrisma = prisma.({
  query: {
    : {
      async ({ model, operation, args, query }) {
        const tenantId = await prisma.;
        return query(args);
      }
    }
  }
}) as typeof basePrisma;" >> js-ddd-inventory/src/infrastructure/database/generated/index.mjs && echo '' >> js-ddd-inventory/src/infrastructure/database/generated/index.mjs && echo 'export { TenantEntity } from "../entities/Tenant";' >> js-ddd-inventory/src/infrastructure/database/generated/index.mjs
