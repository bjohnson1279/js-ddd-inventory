import { Router } from "express";
import { ShopifyWebhookController } from "../controllers/ShopifyWebhookController";
import { DispatchStock } from "../../../application/useCases/DispatchStock";
import { InMemoryInventoryRepository } from "../../database/InMemoryInventoryRepository";
import { ShopifyWebhookSecurity } from "../../shopify/ShopifyWebhookSecurity";

const router = Router();

// Manual DI matching the project's style
const repository = new InMemoryInventoryRepository(); // In a real app, this would be a shared singleton
const dispatchStock = new DispatchStock(repository);
const security = new ShopifyWebhookSecurity(process.env.SHOPIFY_API_SECRET || 'dummy_secret');
const controller = new ShopifyWebhookController(dispatchStock, security);

router.post("/webhooks/orders/create", (req, res) => controller.handleOrderCreated(req, res));

export default router;
