import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { StockOnboarding } from "../../../domain/onboarding/aggregates/StockOnboarding";
import { OpeningBalanceService } from "../../../domain/onboarding/services/OpeningBalanceService";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { DomainException } from "../../../domain/exceptions/DomainException";
import { Logger } from "../../../infrastructure/logging/logger";

export class OnboardingController {
  static async submit(request: FastifyRequest, reply: FastifyReply) {
    try {
      const repository = request.server["repository"] as IInventoryRepository;
      const { locationId, asOfDate, items, actorId } = request.body;

      if (!locationId || !asOfDate || !Array.isArray(items)) {
        return res
          .status(400)
          .send({ error: "Missing required onboarding data" });
      }

      const onboarding = new StockOnboarding(
        Date.now().toString(),
        locationId,
        new Date(asOfDate),
      );

      for (const item of items) {
        onboarding.setItem(item.sku, item.quantity, item.unitCostCents);
      }

      onboarding.submit();

      const service = new OpeningBalanceService(repository);
      await service.process(onboarding, actorId || "system");

      reply.status(200).send({ message: "Initial inventory setup successful" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "OnboardingController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "OnboardingController", message: "Onboarding submission failed:", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }
}
