import { Router } from "express";
import { AuthController } from "../controllers/AuthController";

const router = Router();

router.post("/setup", AuthController.setup);
router.post("/login", AuthController.login);

export default router;
