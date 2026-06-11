import { Router } from "express";
import { QuarantineController } from "../controllers/QuarantineController";

const router = Router();

router.get("/", QuarantineController.list);
router.get("/:id", QuarantineController.get);
router.post("/:id/resolve", QuarantineController.resolve);

export default router;
