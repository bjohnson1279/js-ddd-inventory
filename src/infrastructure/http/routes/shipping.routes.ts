import { Router } from "express";
import { ShippingController } from "../controllers/ShippingController";

const router = Router();

router.get("/rates", ShippingController.getRates);
router.post("/labels", ShippingController.purchaseLabel);
router.get("/shipments", ShippingController.getShipments);
router.post("/shipments/:id/track", ShippingController.trackShipment);
router.post("/route", ShippingController.routeOrder);
router.post("/quote", ShippingController.calculateCarrierRates);
router.post("/label", ShippingController.generateShippingLabel);

export default router;
