import { prisma } from "../../infrastructure/database/prisma";

export class ManageRolesUseCase {
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
  }
}
