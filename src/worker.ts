import { prisma } from "./infrastructure/database/prisma";
import { PrismaOutboxRepository } from "./infrastructure/database/PrismaOutboxRepository";
import { OutboxProcessor } from "./infrastructure/outbox/OutboxProcessor";
import { KafkaMessageBroker } from "./infrastructure/messaging/KafkaMessageBroker";
import { RabbitMQMessageBroker } from "./infrastructure/messaging/RabbitMQMessageBroker";
import { InMemoryMessageBroker } from "./infrastructure/messaging/InMemoryMessageBroker";
import { WebhookDeliveryWorker } from "./infrastructure/workers/WebhookDeliveryWorker";
import { Logger } from "./infrastructure/logging/logger";

const outboxRepo = new PrismaOutboxRepository();
const kafkaUrl = process.env.KAFKA_URL;
const rabbitMqUrl = process.env.RABBITMQ_URL;

const messageBroker = kafkaUrl
  ? new KafkaMessageBroker(kafkaUrl)
  : rabbitMqUrl
    ? new RabbitMQMessageBroker(rabbitMqUrl)
    : new InMemoryMessageBroker();

Logger.info({ context: "Worker", message: "Starting js-ddd-inventory Outbox Worker..." });
const outboxProcessor = new OutboxProcessor(outboxRepo, messageBroker);

// Start polling
const intervalMs = process.env.WORKER_INTERVAL_MS ? parseInt(process.env.WORKER_INTERVAL_MS) : 3000;
outboxProcessor.start(intervalMs);
WebhookDeliveryWorker.start(intervalMs);
Logger.info({ context: "Worker", message: `Outbox worker started (polling every ${intervalMs}ms)` });

// Graceful shutdown
  const safeDisconnect = async () => {
    if ('disconnect' in messageBroker && typeof (messageBroker as any).disconnect === 'function') {
      try {
        await (messageBroker as any).disconnect();
      } catch (err) {
        Logger.error({ context: "Worker", message: "Error disconnecting message broker" }, err);
      }
    }
  };

  process.on("SIGTERM", async () => {
    Logger.info({ context: "Worker", message: "Shutting down outbox worker..." });
    outboxProcessor.stop();
    WebhookDeliveryWorker.stop();
    await safeDisconnect();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    Logger.info({ context: "Worker", message: "Shutting down outbox worker..." });
    outboxProcessor.stop();
    WebhookDeliveryWorker.stop();
    await safeDisconnect();
    process.exit(0);
  });
