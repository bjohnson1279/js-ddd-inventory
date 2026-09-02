import { prisma } from "../../infrastructure/database/prisma";

export class ManageRolesUseCase {
<<<<<<< HEAD
  static async createCustomRole(
    tenantId: string,
    name: string,
    description: string | undefined,
    permissionIds: string[] | undefined
  ) {
    if (!name) {
      throw new Error("name is required.");
    }

    const id = `custom_${tenantId}_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

    let validPermissionIds: string[] = [];
    if (permissionIds && Array.isArray(permissionIds)) {
      const validPermissions = await prisma.permissionModel.findMany({
        where: { id: { in: permissionIds } }
      });
      if (validPermissions.length !== permissionIds.length) {
        const valid = new Set(validPermissions.map((p: any) => p.id));
        const invalid = permissionIds.filter((pid: string) => !valid.has(pid));
        throw new Error(`Invalid permission IDs: ${invalid.join(', ')}`);
      }
      validPermissionIds = permissionIds;
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.roleModel.create({
        data: {
          id,
          name,
          description: description || "",
          isCustom: true,
          tenantId
        }
      });

      if (validPermissionIds.length > 0) {
        await tx.rolePermissionModel.createMany({
          data: validPermissionIds.map((pid: string) => ({ roleId: id, permissionId: pid }))
        });
      }
    });

    return { id, name, description, isCustom: true, tenantId };
=======
<<<<<<< HEAD
  static async listPermissions() {
    const permissions = await prisma.permissionModel.findMany({
      orderBy: [
        { resource: 'asc' },
        { action: 'asc' }
      ]
    });
    return permissions.map((p: any) => ({
      id: p.id,
      resource: p.resource,
      action: p.action,
      description: p.description
    }));
=======
  async updateRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    const existingRole = await prisma.roleModel.findUnique({ where: { id: roleId } });
    if (!existingRole) {
      throw new Error(`NOT_FOUND: Role ${roleId} not found.`);
    }

    const validPermissions = await prisma.permissionModel.findMany({
      where: { id: { in: permissionIds } }
    });
    if (validPermissions.length !== permissionIds.length) {
      const valid = new Set(validPermissions.map(p => p.id));
      const invalid = permissionIds.filter(pid => !valid.has(pid));
      throw new Error(`INVALID_INPUT: Invalid permission IDs: ${invalid.join(', ')}`);
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
>>>>>>> origin/main
>>>>>>> origin/main
  }
}
