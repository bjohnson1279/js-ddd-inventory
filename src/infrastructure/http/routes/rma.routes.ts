import { Router } from "express";
import { RMAController } from "../controllers/RMAController";

const router = Router();

router.post("/", RMAController.create);
router.get("/:id", RMAController.get);
router.post("/:id/authorize", RMAController.authorize);
router.post("/:id/receive", RMAController.receive);

export default router;
