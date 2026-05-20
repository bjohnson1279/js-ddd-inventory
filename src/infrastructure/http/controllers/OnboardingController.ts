import { Request, Response } from "express";
import { StockOnboarding } from "../../../domain/onboarding/aggregates/StockOnboarding";
import { OpeningBalanceService } from "../../../domain/onboarding/services/OpeningBalanceService";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";

export class OnboardingController {
  static async submit(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { locationId, asOfDate, items, actorId } = req.body;

      if (!locationId || !asOfDate || !Array.isArray(items)) {
        return res.status(400).json({ error: "Missing required onboarding data" });
      }

      const onboarding = new StockOnboarding(
        Date.now().toString(),
        locationId,
        new Date(asOfDate)
      );

      for (const item of items) {
        onboarding.setItem(item.sku, item.quantity, item.unitCostCents);
      }

      onboarding.submit();

      const service = new OpeningBalanceService(repository);
      await service.process(onboarding, actorId || "system");

      res.status(200).json({ message: "Initial inventory setup successful" });
    } catch (error: any) {
      console.error("Onboarding submission failed:", error);
      res.status(400).json({ error: error.message });
    }
  }
}
