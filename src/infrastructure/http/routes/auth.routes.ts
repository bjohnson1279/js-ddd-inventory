import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { rateLimit } from "express-rate-limit";

const parseEnvInt = (val: string | undefined, fallback: number): number => {
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
};

const authLimiter = rateLimit({
  windowMs: parseEnvInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  limit: parseEnvInt(process.env.AUTH_RATE_LIMIT_MAX, 5),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." }
});


const setupLimiter = rateLimit({
  windowMs: parseEnvInt(process.env.SETUP_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  limit: parseEnvInt(process.env.SETUP_RATE_LIMIT_MAX, 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: "Too many setup attempts, please try again later." }
});

const router = Router();

router.post("/setup", setupLimiter, AuthController.setup);
router.post("/login", authLimiter, AuthController.login);

export default router;
