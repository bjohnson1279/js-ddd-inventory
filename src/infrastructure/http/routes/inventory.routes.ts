import { Router } from "express";
import { InventoryController } from "../controllers/InventoryController";
import { requireRole } from "../middleware/auth";

const router = Router();

router.get("/", InventoryController.list);
router.post("/receive", InventoryController.receive);
router.post("/dispatch", InventoryController.dispatch);
router.post("/count", InventoryController.performCount);
router.get("/fefo-pick", InventoryController.suggestFefoPick);
router.get("/reports/recall/:lotNumber", InventoryController.traceRecall);
router.get("/:sku", InventoryController.getLevel);

router.post("/allocate", requireRole(["admin", "warehouse_operator"]), InventoryController.allocate);
router.post("/release-allocation", requireRole(["admin", "warehouse_operator"]), InventoryController.releaseAllocation);
router.post("/fulfill-allocation", requireRole(["admin", "warehouse_operator"]), InventoryController.fulfillAllocation);
router.post("/create-in-transit", requireRole(["admin", "warehouse_operator"]), InventoryController.createInTransit);
router.post("/receive-in-transit", requireRole(["admin", "warehouse_operator"]), InventoryController.receiveInTransit);

export default router;
