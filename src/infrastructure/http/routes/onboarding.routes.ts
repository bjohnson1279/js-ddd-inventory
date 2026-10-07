import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { OnboardingController } from "../controllers/OnboardingController";

const router: FastifyPluginAsync = async (fastify) => {

fastify.post("/submit", OnboardingController.submit);

};
export default router;
