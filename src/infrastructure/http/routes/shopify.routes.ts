import { Router } from "express";
import { ShopifyWebhookController } from "../controllers/ShopifyWebhookController";
import { ShopifyWebhookSecurity } from "../../shopify/ShopifyWebhookSecurity";

const router = Router();

if (!process.env.SHOPIFY_API_SECRET) {
  throw new Error('SHOPIFY_API_SECRET is not defined');
}
const security = new ShopifyWebhookSecurity(process.env.SHOPIFY_API_SECRET);
const controller = new ShopifyWebhookController(security);

router.post("/webhooks/orders/create", (req, res) => controller.handleOrderCreated(req, res));

export default router;
