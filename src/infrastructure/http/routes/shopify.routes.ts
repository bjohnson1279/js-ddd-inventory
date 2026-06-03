import { Router } from "express";
import { ShopifyWebhookController } from "../controllers/ShopifyWebhookController";
import { ShopifyWebhookSecurity } from "../../shopify/ShopifyWebhookSecurity";

const router = Router();

const secret = process.env.SHOPIFY_API_SECRET;
if (!secret) {
  throw new Error("SHOPIFY_API_SECRET environment variable is required for webhook security");
}

const security = new ShopifyWebhookSecurity(secret);
const controller = new ShopifyWebhookController(security);

router.post("/webhooks/orders/create", (req, res) => controller.handleOrderCreated(req, res));

export default router;
