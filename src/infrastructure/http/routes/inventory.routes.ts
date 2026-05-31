import { Router } from "express";
import { InventoryController } from "../controllers/InventoryController";

const router = Router();

router.get("/", InventoryController.list);
router.post("/receive", InventoryController.receive);
router.post("/dispatch", InventoryController.dispatch);
router.post("/count", InventoryController.performCount);
router.get("/:sku", InventoryController.getLevel);

export default router;
