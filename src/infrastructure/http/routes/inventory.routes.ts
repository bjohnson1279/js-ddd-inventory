import { Router } from "express";
import { InventoryController } from "../controllers/InventoryController";
import { requirePermission } from "../middleware/auth";

const router = Router();

router.get("/", InventoryController.list);
router.post("/receive", InventoryController.receive);
router.post("/dispatch", InventoryController.dispatch);
router.post("/count", InventoryController.performCount);
router.get("/fefo-pick", InventoryController.suggestFefoPick);
router.get("/reports/recall/:lotNumber", InventoryController.traceRecall);
router.get("/:sku", InventoryController.getLevel);

router.post("/allocate", requirePermission('inventory', 'view'), InventoryController.allocate);
router.post("/release-allocation", requirePermission('inventory', 'view'), InventoryController.releaseAllocation);
router.post("/fulfill-allocation", requirePermission('inventory', 'view'), InventoryController.fulfillAllocation);
router.post("/create-in-transit", requirePermission('inventory', 'view'), InventoryController.createInTransit);
router.post("/receive-in-transit", requirePermission('inventory', 'view'), InventoryController.receiveInTransit);

export default router;
