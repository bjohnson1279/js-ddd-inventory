import { Router } from "express";
import { KitController } from "../controllers/KitController";
import { requireRole } from "../middleware/auth";

const router = Router();

router.get("/", KitController.list);
router.post("/create", KitController.create);
router.post("/dispatch", KitController.dispatchSale);
router.post("/assemble", requireRole(["admin", "warehouse_operator"]), KitController.assemble);
router.post("/disassemble", requireRole(["admin", "warehouse_operator"]), KitController.disassemble);

export default router;
