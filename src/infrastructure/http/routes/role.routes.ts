import { Router } from "express";
import { RoleController } from "../controllers/RoleController";
import { requireRole } from "../middleware/auth";

const router = Router();

// Only tenant admins can manage roles and permissions
router.use(requireRole(["admin"]));

router.get("/", RoleController.listRoles);
router.post("/", RoleController.createRole);
router.put("/:roleId/permissions", RoleController.updateRolePermissions);
router.delete("/:roleId", RoleController.deleteRole);

export default router;
