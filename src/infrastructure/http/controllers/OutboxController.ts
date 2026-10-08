import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { IOutboxRepository } from "../../../domain/repositories/IOutboxRepository";
import { DomainException } from "../../../domain/exceptions/DomainException";
import { Logger } from "../../../infrastructure/logging/logger";


export class OutboxController {
  static async listDeadLettered(request: any, reply: any) {
    try {
      const outboxRepository = (request.server as any)["outboxRepository"] as IOutboxRepository;
      if (((request.query as any).limit !== undefined && typeof (request.query as any).limit !== "string") ||
          ((request.query as any).maxAttempts !== undefined && typeof (request.query as any).maxAttempts !== "string")) {
        return reply.status(400).send({ error: "Invalid query parameters" });
      }
      const limit = (request.query as any).limit ? parseInt((request.query as any).limit as string, 10) : 50;
      const maxAttempts = (request.query as any).maxAttempts ? parseInt((request.query as any).maxAttempts as string, 10) : 5;
      if (isNaN(limit) || isNaN(maxAttempts)) {
        return reply.status(400).send({ error: "Invalid query parameters" });
      }

      const events = await outboxRepository.fetchDeadLettered(limit, maxAttempts);

      reply.status(200).send(
        events.map((event) => ({
          id: event.id,
          eventName: event.eventName,
          payload: JSON.parse(event.payload),
          occurredOn: event.occurredOn,
          processedAt: event.processedAt,
          attempts: event.attempts,
          lastError: event.lastError,
          nextAttemptAt: event.nextAttemptAt
        }))
      );
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "OutboxController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "OutboxController", message: "Failed to list dead lettered outbox events:", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async retry(request: any, reply: any) {
    try {
      const outboxRepository = (request.server as any)["outboxRepository"] as IOutboxRepository;
      const { id } = (request.params as any);

      await outboxRepository.retryEvent(id);

      reply.status(200).send({ message: "Event successfully scheduled for retry" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "OutboxController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "OutboxController", message: `Failed to retry outbox event ${(request.params as any).id}:`, error: error });
        reply.status(500).send({ error: "Failed to retry event" });
      }
    }
  }

  static async getStats(request: any, reply: any) {
    try {
      const outboxRepository = (request.server as any)["outboxRepository"] as IOutboxRepository;
      if ((request.query as any).maxAttempts !== undefined && typeof (request.query as any).maxAttempts !== "string") {
        return reply.status(400).send({ error: "Invalid maxAttempts parameter" });
      }
      const maxAttempts = (request.query as any).maxAttempts ? parseInt((request.query as any).maxAttempts as string, 10) : 5;
      if (isNaN(maxAttempts)) {
        return reply.status(400).send({ error: "Invalid maxAttempts parameter" });
      }

      const stats = await outboxRepository.fetchStats(maxAttempts);

      reply.status(200).send({
        totalPending: stats.totalPending,
        totalProcessed: stats.totalProcessed,
        totalDeadLettered: stats.totalDeadLettered,
        recentFailures: stats.recentFailures.map((event: any) => ({
          id: event.id,
          eventName: event.eventName,
          payload: JSON.parse(event.payload),
          occurredOn: event.occurredOn,
          processedAt: event.processedAt,
          attempts: event.attempts,
          lastError: event.lastError,
          nextAttemptAt: event.nextAttemptAt
        }))
      });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "OutboxController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "OutboxController", message: "Failed to get outbox metrics:", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }
}
