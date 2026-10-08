import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { prisma } from "../../database/prisma";
import { Logger } from "../../../infrastructure/logging/logger";
import { AuthenticatedRequest } from "../middleware/auth";
import { ManageRolesUseCase } from "../../../application/useCases/ManageRolesUseCase";

export class RoleController {
  static async listRoles(request: AuthenticatedRequest, reply: any) {
    try {
      const tenantId = request.tenantId || "tenant-1";
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

      return reply.status(200).send({ roles: formattedRoles });
    } catch (error: any) {
      Logger.error({ context: "RoleController", message: "Failed to list roles", error: error });
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async createRole(request: AuthenticatedRequest, reply: any) {
    try {
      const tenantId = request.tenantId || "tenant-1";
      const { name, description, permissionIds } = (request.body as any);

      const result = await ManageRolesUseCase.createCustomRole(tenantId, name, description, permissionIds);

      return reply.status(201).send({ success: true, message: "Role created successfully.", id: result.id });
    } catch (error: any) {
      if (error.message && (error.message.includes("name is required") || error.message.includes("Invalid permission IDs"))) {
        return reply.status(400).send({ error: error.message });
      }
      Logger.error({ context: "RoleController", message: "Failed to create role", error: error });
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async updateRolePermissions(request: AuthenticatedRequest, reply: any) {
    try {
      const { roleId } = (request.params as any);
      const { permissionIds } = (request.body as any);

      if (!Array.isArray(permissionIds)) {
        return reply.status(400).send({ error: "permissionIds must be an array." });
      }

      const existingRole = await prisma.roleModel.findUnique({ where: { id: roleId } });
      if (!existingRole) {
        return reply.status(404).send({ error: `Role ${roleId} not found.` });
      }

      const validPermissions = await prisma.permissionModel.findMany({
        where: { id: { in: permissionIds } }
      });
      if (validPermissions.length !== permissionIds.length) {
        const valid = new Set(validPermissions.map(p => p.id));
        const invalid = permissionIds.filter(pid => !valid.has(pid));
        return reply.status(400).send({ error: `Invalid permission IDs: ${invalid.join(', ')}` });
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

      return reply.status(200).send({ success: true, message: "Role permissions updated successfully." });
    } catch (error: any) {
      Logger.error({ context: "RoleController", message: "Failed to update role permissions", error: error });
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async listPermissions(request: AuthenticatedRequest, reply: any) {
    try {
      const permissions = await ManageRolesUseCase.listPermissions();
      return reply.status(200).send({ permissions });
    } catch (error: any) {
      Logger.error({ context: "RoleController", message: "Failed to list permissions", error });
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async deleteRole(request: AuthenticatedRequest, reply: any) {
    try {
      const { roleId } = (request.params as any);

      const existingRole = await prisma.roleModel.findUnique({ 
        where: { id: roleId },
        include: { userRoles: true }
      });
      
      if (!existingRole) {
        return reply.status(404).send({ error: `Role ${roleId} not found.` });
      }

      if (!existingRole.isCustom) {
        return reply.status(403).send({ error: "Cannot delete a built-in system role." });
      }

      if (existingRole.userRoles.length > 0) {
        return reply.status(403).send({ error: `Cannot delete role '${existingRole.name}': ${existingRole.userRoles.length} user(s) are currently assigned.` });
      }

      await prisma.roleModel.delete({
        where: { id: roleId }
      });

      return reply.status(200).send({ success: true, message: "Role deleted successfully." });
    } catch (error: any) {
      Logger.error({ context: "RoleController", message: "Failed to delete role", error: error });
      return reply.status(500).send({ error: "Internal server error" });
    }
  }
}
