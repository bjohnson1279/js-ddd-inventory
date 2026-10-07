import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { AccountingController } from "../controllers/AccountingController";

const router: FastifyPluginAsync = async (fastify) => {

fastify.get("/ledger", AccountingController.getLedger);
fastify.post("/stock-received", AccountingController.recordStockReceived);
fastify.post("/stock-sold", AccountingController.recordStockSold);
fastify.get("/valuation/:variantId", AccountingController.calculateValuation);
fastify.get("/tenant-config/:tenantId", AccountingController.getTenantConfig);
fastify.post("/tenant-config", AccountingController.saveTenantConfig);
fastify.post("/sync-journal", AccountingController.syncJournal);

};
export default router;
