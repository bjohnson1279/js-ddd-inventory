import { Router } from "express";
import { ShopifyWebhookController } from "../controllers/ShopifyWebhookController";
import { ShopifyWebhookSecurity } from "../../shopify/ShopifyWebhookSecurity";

const router = Router();

const shopifyApiSecret = process.env.SHOPIFY_API_SECRET;
if (!shopifyApiSecret) {
  throw new Error('SHOPIFY_API_SECRET environment variable is missing.');
}

const security = new ShopifyWebhookSecurity(shopifyApiSecret);
const controller = new ShopifyWebhookController(security);

router.post("/webhooks/orders/create", (req, res) => controller.handleOrderCreated(req, res));

export default router;
