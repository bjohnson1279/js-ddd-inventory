import { Router } from "express";
import { OnboardingController } from "../controllers/OnboardingController";

const router = Router();

router.post("/submit", OnboardingController.submit);

export default router;
