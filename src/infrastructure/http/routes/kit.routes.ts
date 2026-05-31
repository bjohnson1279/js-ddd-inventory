import { Router } from "express";
import { KitController } from "../controllers/KitController";

const router = Router();

router.get("/", KitController.list);
router.post("/create", KitController.create);
router.post("/dispatch", KitController.dispatchSale);

export default router;
