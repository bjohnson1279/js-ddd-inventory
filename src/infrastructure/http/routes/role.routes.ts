import { Router } from "express";
import { requirePermission } from "../middleware/auth";

const router = Router();

/**
 * Role Management Routes
 *
 * GET    /api/roles                       — List roles (system + tenant custom)
 * POST   /api/roles                       — Create custom role
 * PUT    /api/roles/:id/permissions       — Update role permissions
 * DELETE /api/roles/:id                   — Delete custom role
 * GET    /api/roles/permissions           — List all permissions catalog
 * POST   /api/users/:id/roles             — Assign roles to user
 * DELETE /api/users/:id/roles             — Remove roles from user
 * GET    /api/users/:id/effective-permissions — Get user's effective permissions
 */

router.get("/", requirePermission('user', 'edit_role'), (req, res) => {
  // TODO: Wire to ManageRolesUseCase.listRoles
  res.status(501).json({ error: "Not yet implemented" });
});

router.post("/", requirePermission('user', 'edit_role'), (req, res) => {
  // TODO: Wire to ManageRolesUseCase.createCustomRole
  res.status(501).json({ error: "Not yet implemented" });
});

router.put("/:id/permissions", requirePermission('user', 'edit_role'), (req, res) => {
  // TODO: Wire to ManageRolesUseCase.updateRolePermissions
  res.status(501).json({ error: "Not yet implemented" });
});

router.delete("/:id", requirePermission('user', 'edit_role'), (req, res) => {
  // TODO: Wire to ManageRolesUseCase.deleteCustomRole
  res.status(501).json({ error: "Not yet implemented" });
});

router.get("/permissions", requirePermission('user', 'edit_role'), (req, res) => {
  // TODO: Wire to ManageRolesUseCase.listPermissions
  res.status(501).json({ error: "Not yet implemented" });
});

export default router;
