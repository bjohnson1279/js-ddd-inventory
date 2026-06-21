import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { rateLimit } from "express-rate-limit";

const authLimiter = rateLimit({
  windowMs: process.env.AUTH_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) : 15 * 60 * 1000,
  limit: process.env.AUTH_RATE_LIMIT_MAX ? parseInt(process.env.AUTH_RATE_LIMIT_MAX) : 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." }
});



const router = Router();

router.post("/setup", AuthController.setup);
router.post("/login", authLimiter, AuthController.login);

export default router;
