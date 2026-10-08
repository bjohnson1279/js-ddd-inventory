import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { RoleController } from "../controllers/RoleController";
import { requireRole, requirePermission } from "../middleware/auth";
import { ManageRolesUseCase } from "../../../application/useCases/ManageRolesUseCase";
import { Logger } from "../../../infrastructure/logging/logger";

const router: FastifyPluginAsync = async (fastify) => {

fastify.addHook('preHandler', requireRole(["admin"]));

fastify.get("/permissions", { preHandler: [requirePermission('user', 'edit_role')] }, RoleController.listPermissions);

fastify.get("/", { preHandler: [requirePermission('user', 'edit_role')] }, async (request: any, reply: any) => {
  try {
    const tenantId = request.tenantId || "tenant-1";
    const roles = await ManageRolesUseCase.listRoles(tenantId);
    return reply.status(200).send(roles);
  } catch (error) {
    return reply.status(500).send({ error: "Internal server error" });
  }
});

fastify.post("/", { preHandler: [requirePermission('user', 'edit_role')] }, async (request: any, reply: any) => {
  try {
    const tenantId = request.tenantId || "tenant-1";
    const { name, description, permissionIds } = (request.body as any);

    const result = await ManageRolesUseCase.createCustomRole(tenantId, name, description, permissionIds);

    return reply.status(201).send({ success: true, message: "Role created successfully.", id: result.id });
  } catch (error: any) {
    if (error.message && (error.message.includes("name is required") || error.message.includes("Invalid permission IDs"))) {
      return reply.status(400).send({ error: error.message });
    }
    Logger.error({ context: "RoleRoute", message: "Failed to create role", error: error });
    return reply.status(500).send({ error: "Internal server error" });
  }
});

fastify.put("/:roleId/permissions", RoleController.updateRolePermissions);
fastify.delete("/:roleId", RoleController.deleteRole);

};
export default router;
