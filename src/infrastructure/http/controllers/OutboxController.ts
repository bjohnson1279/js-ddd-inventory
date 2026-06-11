import { Request, Response } from "express";
import { IOutboxRepository } from "../../../domain/repositories/IOutboxRepository";

export class OutboxController {
  static async listDeadLettered(req: Request, res: Response) {
    try {
      const outboxRepository = req.app.get("outboxRepository") as IOutboxRepository;
      const limit = parseInt(req.query.limit as string) || 50;
      const maxAttempts = parseInt(req.query.maxAttempts as string) || 5;

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
      console.error("Failed to list dead lettered outbox events:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }

  static async retry(req: Request, res: Response) {
    try {
      const outboxRepository = req.app.get("outboxRepository") as IOutboxRepository;
      const { id } = req.params;

      await outboxRepository.retryEvent(id);

      res.status(200).json({ message: "Event successfully scheduled for retry" });
    } catch (error: any) {
      console.error(`Failed to retry outbox event ${req.params.id}:`, error);
      res.status(400).json({ error: error.message || "Failed to retry event" });
    }
  }

  static async getStats(req: Request, res: Response) {
    try {
      const outboxRepository = req.app.get("outboxRepository") as IOutboxRepository;
      const maxAttempts = parseInt(req.query.maxAttempts as string) || 5;

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
      console.error("Failed to get outbox metrics:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
}
