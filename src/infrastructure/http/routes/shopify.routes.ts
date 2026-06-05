import { Router } from "express";
import { ShopifyWebhookController } from "../controllers/ShopifyWebhookController";
import { ShopifyWebhookSecurity } from "../../shopify/ShopifyWebhookSecurity";

const router = Router();

let controller: ShopifyWebhookController;

router.post("/webhooks/orders/create", (req, res) => {
  if (!controller) {
    const secret = process.env.SHOPIFY_API_SECRET;
    if (!secret) {
      throw new Error("SHOPIFY_API_SECRET environment variable is required for security.");
    }
    const security = new ShopifyWebhookSecurity(secret);
    controller = new ShopifyWebhookController(security);
  }
  return controller.handleOrderCreated(req, res);
});

export default router;
