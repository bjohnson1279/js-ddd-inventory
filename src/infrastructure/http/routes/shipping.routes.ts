import { Router } from "express";
import { ShippingController } from "../controllers/ShippingController";
import { requireRole } from "../middleware/auth";

const router = Router();

router.get("/rates", requireRole(["admin", "warehouse_operator", "viewer"]), ShippingController.getRates);
router.post("/labels", requireRole(["admin", "warehouse_operator"]), ShippingController.purchaseLabel);
router.get("/shipments", requireRole(["admin", "warehouse_operator", "viewer"]), ShippingController.getShipments);
router.post("/shipments/:id/track", requireRole(["admin", "warehouse_operator"]), ShippingController.trackShipment);
router.post("/route", requireRole(["admin", "warehouse_operator"]), ShippingController.routeOrder);

export default router;
