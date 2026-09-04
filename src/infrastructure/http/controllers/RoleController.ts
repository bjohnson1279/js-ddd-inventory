import { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { Logger } from "../../../infrastructure/logging/logger";
import { AuthenticatedRequest } from "../middleware/auth";
import { ManageRolesUseCase } from "../../../application/useCases/ManageRolesUseCase";

export class RoleController {
  static async listRoles(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId || "tenant-1";
      const roles = await prisma.roleModel.findMany({
        where: {
          OR: [
            { isCustom: false },
            { tenantId: tenantId }
          ]
        },
        include: {
          rolePermissions: {
            include: { permission: true }
          }
        },
        orderBy: { name: 'asc' }
      });
      
      const formattedRoles = roles.map((role: any) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        isCustom: role.isCustom,
        permissions: role.rolePermissions.map((rp: any) => ({
          id: rp.permission.id,
          resource: rp.permission.resource,
          action: rp.permission.action,
          description: rp.permission.description
        }))
      }));

      return res.status(200).json({ roles: formattedRoles });
    } catch (error: any) {
      Logger.error({ context: "RoleController", message: "Failed to list roles", error: error });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async createRole(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId || "tenant-1";
      const { name, description, permissionIds } = req.body;

      const result = await ManageRolesUseCase.createCustomRole(tenantId, name, description, permissionIds);

      return res.status(201).json({ success: true, message: "Role created successfully.", id: result.id });
    } catch (error: any) {
      if (error.message && (error.message.includes("name is required") || error.message.includes("Invalid permission IDs"))) {
        return res.status(400).json({ error: error.message });
      }
      Logger.error({ context: "RoleController", message: "Failed to create role", error: error });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async updateRolePermissions(req: AuthenticatedRequest, res: Response) {
    try {
      const { roleId } = req.params;
      const { permissionIds } = req.body;

      if (!Array.isArray(permissionIds)) {
        return res.status(400).json({ error: "permissionIds must be an array." });
      }

      const existingRole = await prisma.roleModel.findUnique({ where: { id: roleId } });
      if (!existingRole) {
        return res.status(404).json({ error: `Role ${roleId} not found.` });
      }

      const validPermissions = await prisma.permissionModel.findMany({
        where: { id: { in: permissionIds } }
      });
      if (validPermissions.length !== permissionIds.length) {
        const valid = new Set(validPermissions.map(p => p.id));
        const invalid = permissionIds.filter(pid => !valid.has(pid));
        return res.status(400).json({ error: `Invalid permission IDs: ${invalid.join(', ')}` });
      }

      await prisma.$transaction(async (tx: any) => {
        // Clear existing permissions
        await tx.rolePermissionModel.deleteMany({
          where: { roleId }
        });

        // Assign new permissions
        if (permissionIds.length > 0) {
          await tx.rolePermissionModel.createMany({
            data: permissionIds.map((pid: string) => ({ roleId, permissionId: pid }))
          });
        }
      });

      return res.status(200).json({ success: true, message: "Role permissions updated successfully." });
    } catch (error: any) {
      Logger.error({ context: "RoleController", message: "Failed to update role permissions", error: error });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async listPermissions(req: AuthenticatedRequest, res: Response) {
    try {
      const permissions = await ManageRolesUseCase.listPermissions();
      return res.status(200).json({ permissions });
    } catch (error: any) {
      Logger.error({ context: "RoleController", message: "Failed to list permissions", error });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async deleteRole(req: AuthenticatedRequest, res: Response) {
    try {
      const { roleId } = req.params;

      const existingRole = await prisma.roleModel.findUnique({ 
        where: { id: roleId },
        include: { userRoles: true }
      });
      
      if (!existingRole) {
        return res.status(404).json({ error: `Role ${roleId} not found.` });
      }

      if (!existingRole.isCustom) {
        return res.status(403).json({ error: "Cannot delete a built-in system role." });
      }

      if (existingRole.userRoles.length > 0) {
        return res.status(403).json({ error: `Cannot delete role '${existingRole.name}': ${existingRole.userRoles.length} user(s) are currently assigned.` });
      }

      await prisma.roleModel.delete({
        where: { id: roleId }
      });

      return res.status(200).json({ success: true, message: "Role deleted successfully." });
    } catch (error: any) {
      Logger.error({ context: "RoleController", message: "Failed to delete role", error: error });
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
