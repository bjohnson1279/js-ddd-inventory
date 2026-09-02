import { Router } from "express";
import { RoleController } from "../controllers/RoleController";
import { requireRole, requirePermission } from "../middleware/auth";
<<<<<<< HEAD
=======
import { ManageRolesUseCase } from "../../../application/useCases/ManageRolesUseCase";
>>>>>>> origin/main

const router = Router();
const manageRolesUseCase = new ManageRolesUseCase();

// Only tenant admins can manage roles and permissions
router.use(requireRole(["admin"]));

router.get("/permissions", requirePermission('user', 'edit_role'), RoleController.listPermissions);
router.get("/", RoleController.listRoles);
router.post("/", RoleController.createRole);
router.put("/:id/permissions", requirePermission('user', 'edit_role'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { permissionIds } = req.body;

    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({ error: "permissionIds must be an array." });
    }

    await manageRolesUseCase.updateRolePermissions(id, permissionIds);
    return res.status(200).json({ success: true, message: "Role permissions updated successfully." });
  } catch (error: any) {
    if (error.message.startsWith('NOT_FOUND:')) {
      return res.status(404).json({ error: error.message.replace('NOT_FOUND: ', '') });
    }
    if (error.message.startsWith('INVALID_INPUT:')) {
      return res.status(400).json({ error: error.message.replace('INVALID_INPUT: ', '') });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.delete("/:roleId", RoleController.deleteRole);

export default router;
