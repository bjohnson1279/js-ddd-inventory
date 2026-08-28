import { Logger } from "./infrastructure/logging/logger";
import { prisma } from "./infrastructure/database/prisma";
import { PrismaOutboxRepository } from "./infrastructure/database/PrismaOutboxRepository";
import { OutboxProcessor } from "./infrastructure/outbox/OutboxProcessor";
import { KafkaMessageBroker } from "./infrastructure/messaging/KafkaMessageBroker";
import { RabbitMQMessageBroker } from "./infrastructure/messaging/RabbitMQMessageBroker";
import { InMemoryMessageBroker } from "./infrastructure/messaging/InMemoryMessageBroker";
import { WebhookDeliveryWorker } from "./infrastructure/workers/WebhookDeliveryWorker";

const outboxRepo = new PrismaOutboxRepository();
const kafkaUrl = process.env.KAFKA_URL;
const rabbitMqUrl = process.env.RABBITMQ_URL;

const messageBroker = kafkaUrl
  ? new KafkaMessageBroker(kafkaUrl)
  : rabbitMqUrl
    ? new RabbitMQMessageBroker(rabbitMqUrl)
    : new InMemoryMessageBroker();

Logger.info({ context: "Worker", message: "[Worker] Starting js-ddd-inventory Outbox Worker..." });
const outboxProcessor = new OutboxProcessor(outboxRepo, messageBroker);

// Start polling
const intervalMs = process.env.WORKER_INTERVAL_MS ? parseInt(process.env.WORKER_INTERVAL_MS) : 3000;
outboxProcessor.start(intervalMs);
WebhookDeliveryWorker.start(intervalMs);

import { ReportSchedulerWorker } from "./infrastructure/workers/ReportSchedulerWorker";
import { ReportGenerationWorker } from "./infrastructure/workers/ReportGenerationWorker";
import { DomainEventDispatcher } from "./domain/events/DomainEventDispatcher";

const reportScheduler = new ReportSchedulerWorker();
reportScheduler.start(60000); // Check schedules every minute

const reportWorker = new ReportGenerationWorker();
DomainEventDispatcher.register("ReportExecutionRequested", async (event: any) => {
  await reportWorker.processEvent(JSON.stringify(event));
});

Logger.info({ context: "Worker", message: `[Worker] Outbox worker started (polling every ${intervalMs}ms)` });

// Graceful shutdown
  const safeDisconnect = async () => {
    if ('disconnect' in messageBroker && typeof (messageBroker as any).disconnect === 'function') {
      try {
        await (messageBroker as any).disconnect();
      } catch (err) {
        Logger.error({ context: "Worker", message: "Failed to disconnect message broker" }, err);
      }
    }
  };

  process.on("SIGTERM", async () => {
    Logger.info({ context: "Worker", message: "[Worker] Shutting down outbox worker..." });
    outboxProcessor.stop();
    WebhookDeliveryWorker.stop();
    reportScheduler.stop();
    await safeDisconnect();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    Logger.info({ context: "Worker", message: "[Worker] Shutting down outbox worker..." });
    outboxProcessor.stop();
    WebhookDeliveryWorker.stop();
    reportScheduler.stop();
    await safeDisconnect();
    process.exit(0);
  });
