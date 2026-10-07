import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { AuthController } from "../controllers/AuthController";
import { requireRole } from "../middleware/auth";

const router: FastifyPluginAsync = async (fastify) => {

fastify.get("/", { preHandler: [requireRole(["admin"])] }, AuthController.listUsers);
fastify.post("/", { preHandler: [requireRole(["admin"])] }, AuthController.inviteUser);
fastify.patch("/:userId/role", { preHandler: [requireRole(["admin"])] }, AuthController.updateUserRole);

};
export default router;
