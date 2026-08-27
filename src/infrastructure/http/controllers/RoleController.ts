import { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { Logger } from "../../../infrastructure/logging/logger";

const DEFAULT_ROLES = ["admin", "warehouse_operator", "inventory_manager", "finance_auditor", "read_only", "accountant", "viewer"];

export class RoleController {
  static async listRoles(req: Request, res: Response) {
    try {
      const roles = await prisma.roleModel.findMany({
        include: {
          rolePermissions: true
        }
      });
      
      const formattedRoles = roles.map((role: any) => ({
        id: role.id,
        name: role.name,
        permissions: role.rolePermissions.map((rp: any) => rp.permission)
      }));

      return res.status(200).json({ roles: formattedRoles });
    } catch (error: any) {
      Logger.error({ context: "RoleController", message: "Failed to list roles", error: error });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async createRole(req: Request, res: Response) {
    try {
      const { id, name, permissions } = req.body;

      if (!id || !name) {
        return res.status(400).json({ error: "id and name are required." });
      }

      const existingRole = await prisma.roleModel.findUnique({ where: { id } });
      if (existingRole) {
        return res.status(400).json({ error: `Role with id ${id} already exists.` });
      }

      await prisma.$transaction(async (tx: any) => {
        await tx.roleModel.create({
          data: { id, name }
        });

        if (permissions && Array.isArray(permissions)) {
          await tx.rolePermissionModel.createMany({
            data: permissions.map((p: string) => ({ roleId: id, permission: p }))
          });
        }
      });

      return res.status(201).json({ success: true, message: "Role created successfully." });
    } catch (error: any) {
      Logger.error({ context: "RoleController", message: "Failed to create role", error: error });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async updateRolePermissions(req: Request, res: Response) {
    try {
      const { roleId } = req.params;
      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: "permissions must be an array." });
      }

      const existingRole = await prisma.roleModel.findUnique({ where: { id: roleId } });
      if (!existingRole) {
        return res.status(404).json({ error: `Role ${roleId} not found.` });
      }

      await prisma.$transaction(async (tx: any) => {
        // Clear existing permissions
        await tx.rolePermissionModel.deleteMany({
          where: { roleId }
        });

        // Assign new permissions
        if (permissions.length > 0) {
          await tx.rolePermissionModel.createMany({
            data: permissions.map((p: string) => ({ roleId, permission: p }))
          });
        }
      });

      return res.status(200).json({ success: true, message: "Role permissions updated successfully." });
    } catch (error: any) {
      Logger.error({ context: "RoleController", message: "Failed to update role permissions", error: error });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async deleteRole(req: Request, res: Response) {
    try {
      const { roleId } = req.params;

      if (DEFAULT_ROLES.includes(roleId)) {
        return res.status(403).json({ error: "Cannot delete a default system role." });
      }

      const existingRole = await prisma.roleModel.findUnique({ where: { id: roleId } });
      if (!existingRole) {
        return res.status(404).json({ error: `Role ${roleId} not found.` });
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
