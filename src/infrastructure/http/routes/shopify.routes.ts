import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { ShopifyWebhookController } from "../controllers/ShopifyWebhookController";
import { ShopifyWebhookSecurity } from "../../shopify/ShopifyWebhookSecurity";

const router: FastifyPluginAsync = async (fastify) => {

const secret = process.env.SHOPIFY_API_SECRET;
if (!secret) {
  throw new Error("SHOPIFY_API_SECRET environment variable is required for security.");
}

const security = new ShopifyWebhookSecurity(secret);
const controller = new ShopifyWebhookController(security);

fastify.post("/webhooks/orders/create", (request: FastifyRequest, reply: FastifyReply) => controller.handleOrderCreated(request, reply));

};
export default router;
