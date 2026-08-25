import { Router } from "express";
import { KitController } from "../controllers/KitController";
import { requirePermission } from "../middleware/auth";

const router = Router();

router.get("/", KitController.list);
router.post("/create", KitController.create);
router.post("/dispatch", KitController.dispatchSale);
router.post("/assemble", requirePermission('kit', 'view'), KitController.assemble);
router.post("/disassemble", requirePermission('kit', 'view'), KitController.disassemble);

export default router;
