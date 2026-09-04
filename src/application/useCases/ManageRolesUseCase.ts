import { prisma } from "../../infrastructure/database/prisma";

export class ManageRolesUseCase {
  async listPermissions() {
    return await prisma.permissionModel.findMany();
  }
}
