import { prisma } from "../../infrastructure/database/prisma";

export class ManageRolesUseCase {
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
  }
}
