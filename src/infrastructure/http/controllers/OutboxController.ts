import { Logger } from "../../logging/logger";
import { Request, Response } from "express";
import { IOutboxRepository } from "../../../domain/repositories/IOutboxRepository";
import { DomainException } from "../../../domain/exceptions/DomainException";


export class OutboxController {
  static async listDeadLettered(req: Request, res: Response) {
    try {
      const outboxRepository = req.app.get("outboxRepository") as IOutboxRepository;
      if ((req.query.limit !== undefined && typeof req.query.limit !== "string") ||
          (req.query.maxAttempts !== undefined && typeof req.query.maxAttempts !== "string")) {
        return res.status(400).json({ error: "Invalid query parameters" });
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const maxAttempts = req.query.maxAttempts ? parseInt(req.query.maxAttempts as string, 10) : 5;
      if (isNaN(limit) || isNaN(maxAttempts)) {
        return res.status(400).json({ error: "Invalid query parameters" });
      }

      const events = await outboxRepository.fetchDeadLettered(limit, maxAttempts);

      res.status(200).json(
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
        Logger.error({ context: "OutboxController" }, error.message);
        res.status(400).json({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "OutboxController", message: "Failed to list dead lettered outbox events:" }, error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async retry(req: Request, res: Response) {
    try {
      const outboxRepository = req.app.get("outboxRepository") as IOutboxRepository;
      const { id } = req.params;

      await outboxRepository.retryEvent(id);

      res.status(200).json({ message: "Event successfully scheduled for retry" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "OutboxController" }, error.message);
        res.status(400).json({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "OutboxController", message: `Failed to retry outbox event ${req.params.id}:` }, error);
        res.status(500).json({ error: "Failed to retry event" });
      }
    }
  }

  static async getStats(req: Request, res: Response) {
    try {
      const outboxRepository = req.app.get("outboxRepository") as IOutboxRepository;
      if (req.query.maxAttempts !== undefined && typeof req.query.maxAttempts !== "string") {
        return res.status(400).json({ error: "Invalid maxAttempts parameter" });
      }
      const maxAttempts = req.query.maxAttempts ? parseInt(req.query.maxAttempts as string, 10) : 5;
      if (isNaN(maxAttempts)) {
        return res.status(400).json({ error: "Invalid maxAttempts parameter" });
      }

      const stats = await outboxRepository.fetchStats(maxAttempts);

      res.status(200).json({
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
        Logger.error({ context: "OutboxController" }, error.message);
        res.status(400).json({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "OutboxController", message: "Failed to get outbox metrics:" }, error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
}
