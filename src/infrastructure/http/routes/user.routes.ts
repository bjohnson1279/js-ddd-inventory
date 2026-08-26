import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { requireRole } from "../middleware/auth";

const router = Router();

router.get("/", requireRole(["admin"]), AuthController.listUsers);
router.post("/", requireRole(["admin"]), AuthController.inviteUser);
router.patch("/:userId/role", requireRole(["admin"]), AuthController.updateUserRole);

export default router;
