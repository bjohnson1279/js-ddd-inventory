import { Router } from "express";
import { ShopifyWebhookController } from "../controllers/ShopifyWebhookController";
import { ShopifyWebhookSecurity } from "../../shopify/ShopifyWebhookSecurity";

const router = Router();

// SECURITY: Remove hardcoded fallback secret in production to prevent unauthorized webhook forgery
const secret = process.env.NODE_ENV === 'test' ? 'dummy_secret' : process.env.SHOPIFY_API_SECRET;
const security = new ShopifyWebhookSecurity(secret);
const controller = new ShopifyWebhookController(security);

router.post("/webhooks/orders/create", (req, res) => controller.handleOrderCreated(req, res));

export default router;
