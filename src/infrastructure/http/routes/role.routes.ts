import { Router } from "express";
import { RoleController } from "../controllers/RoleController";
import { requireRole, requirePermission } from "../middleware/auth";
import { Logger } from "../../../infrastructure/logging/logger";
import { ManageRolesUseCase } from "../../../application/useCases/ManageRolesUseCase";

const router = Router();

// Only tenant admins can manage roles and permissions
router.use(requireRole(["admin"]));

router.get("/permissions", requirePermission('user', 'edit_role'), RoleController.listPermissions);
router.get("/", RoleController.listRoles);
router.post("/", requirePermission('user', 'edit_role'), async (req: any, res: any) => {
  try {
    const tenantId = req.tenantId || "tenant-1";
    const { name, description, permissionIds } = req.body;

    const result = await ManageRolesUseCase.createCustomRole(tenantId, name, description, permissionIds);

    return res.status(201).json({ success: true, message: "Role created successfully.", id: result.id });
  } catch (error: any) {
    if (error.message && (error.message.includes("name is required") || error.message.includes("Invalid permission IDs"))) {
      return res.status(400).json({ error: error.message });
    }
    Logger.error({ context: "RoleRoute", message: "Failed to create role", error: error });
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.put("/:roleId/permissions", RoleController.updateRolePermissions);
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
