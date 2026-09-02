const fs = require('fs');

let file = 'src/application/useCases/ManageRolesUseCase.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/<<<<<<< HEAD\n  async updateRolePermissions.*?=======\n  static async updateRolePermissions.*?>>>>>>> origin\/main/s, `  static async updateRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    const existingRole = await prisma.roleModel.findUnique({ where: { id: roleId } });
    if (!existingRole) {
      throw new Error(\`NOT_FOUND: Role \${roleId} not found.\`);
    }

    const validPermissions = await prisma.permissionModel.findMany({
      where: { id: { in: permissionIds } }
    });
    if (validPermissions.length !== permissionIds.length) {
      const valid = new Set(validPermissions.map(p => p.id));
      const invalid = permissionIds.filter(pid => !valid.has(pid));
      throw new Error(\`INVALID_INPUT: Invalid permission IDs: \${invalid.join(', ')}\`);
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
  }`);
fs.writeFileSync(file, content);

file = 'src/infrastructure/http/controllers/RoleController.ts';
content = fs.readFileSync(file, 'utf8');
content = content.replace(/<<<<<<< HEAD\n  static async updateRolePermissions.*?=======\n>>>>>>> origin\/main/s, `  static async updateRolePermissions(req: AuthenticatedRequest, res: Response) {
    try {
      const { roleId } = req.params;
      const { permissionIds } = req.body;

      if (!Array.isArray(permissionIds)) {
        return res.status(400).json({ error: "permissionIds must be an array." });
      }

      const existingRole = await prisma.roleModel.findUnique({ where: { id: roleId } });
      if (!existingRole) {
        return res.status(404).json({ error: \`Role \${roleId} not found.\` });
      }

      const validPermissions = await prisma.permissionModel.findMany({
        where: { id: { in: permissionIds } }
      });
      if (validPermissions.length !== permissionIds.length) {
        const valid = new Set(validPermissions.map(p => p.id));
        const invalid = permissionIds.filter(pid => !valid.has(pid));
        return res.status(400).json({ error: \`Invalid permission IDs: \${invalid.join(', ')}\` });
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
  }`);
fs.writeFileSync(file, content);

file = 'src/infrastructure/http/routes/approval.routes.ts';
content = fs.readFileSync(file, 'utf8');
content = content.replace(/<<<<<<< HEAD\n\/\/ Get a specific approval request\n=======\n\/\/ TODO: Wire to ManageApprovalWorkflowsUseCase.getApprovalRequest\n>>>>>>> origin\/main/s, `// Get a specific approval request`);
fs.writeFileSync(file, content);

file = 'src/infrastructure/http/routes/role.routes.ts';
content = fs.readFileSync(file, 'utf8');
content = content.replace(/<<<<<<< HEAD\nrouter.post\("\/", requirePermission\('user', 'edit_role'\), async.*?=======\nrouter.post\("\/", RoleController.createRole\);\nrouter.put\("\/:id\/permissions", requirePermission\('user', 'edit_role'\), async \(req: any, res: any\) => {.*?}\);\n>>>>>>> origin\/main/s, `router.post("/", RoleController.createRole);
router.put("/:id/permissions", requirePermission('user', 'edit_role'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { permissionIds } = req.body;

    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({ error: "permissionIds must be an array." });
    }

    await ManageRolesUseCase.updateRolePermissions(id, permissionIds);
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
});`);
fs.writeFileSync(file, content);
