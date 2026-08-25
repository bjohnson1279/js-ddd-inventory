import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { requirePermission } from "../middleware/auth";

const router = Router();

router.get("/", requirePermission('user', 'view'), AuthController.listUsers);
router.post("/", requirePermission('user', 'view'), AuthController.inviteUser);
router.patch("/:userId/role", requirePermission('user', 'view'), AuthController.updateUserRole);

export default router;
