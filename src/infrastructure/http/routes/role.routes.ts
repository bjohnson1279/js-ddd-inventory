import { Router } from "express";
import { RoleController } from "../controllers/RoleController";
import { requireRole } from "../middleware/auth";
import { requireRole, requirePermission } from "../middleware/auth";
import { ManageRolesUseCase } from "../../../application/useCases/ManageRolesUseCase";
import { Logger } from "../../../infrastructure/logging/logger";

const router = Router();

// Only tenant admins can manage roles and permissions
router.use(requireRole(["admin"]));

router.get("/", RoleController.listRoles);
router.post("/", RoleController.createRole);
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
router.delete("/:roleId", RoleController.deleteRole);

export default router;
