import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { AuthController } from "../controllers/AuthController";

const parseEnvInt = (val: string | undefined, fallback: number): number => {
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
};

const authLimitConfig = {
  max: parseEnvInt(process.env.AUTH_RATE_LIMIT_MAX, 5),
  timeWindow: parseEnvInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000)
};

const setupLimitConfig = {
  max: parseEnvInt(process.env.SETUP_RATE_LIMIT_MAX, 10),
  timeWindow: parseEnvInt(process.env.SETUP_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000)
};

const router: FastifyPluginAsync = async (fastify) => {

  fastify.post("/setup", { config: { rateLimit: setupLimitConfig } }, AuthController.setup as any);
  fastify.post("/login", { config: { rateLimit: authLimitConfig } }, AuthController.login as any);

};
export default router;
