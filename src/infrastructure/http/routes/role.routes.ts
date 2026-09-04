import { Router } from "express";
import { RoleController } from "../controllers/RoleController";
import { requireRole, requirePermission } from "../middleware/auth";
import { ManageRolesUseCase } from "../../../application/useCases/ManageRolesUseCase";

const router = Router();

// Only tenant admins can manage roles and permissions
router.use(requireRole(["admin"]));

router.get("/", requirePermission('user', 'edit_role'), async (req, res) => {
  try {
    const roles = await ManageRolesUseCase.listRoles();
    return res.status(200).json(roles);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/", RoleController.createRole);
router.put("/:roleId/permissions", RoleController.updateRolePermissions);
router.delete("/:roleId", RoleController.deleteRole);

export default router;
