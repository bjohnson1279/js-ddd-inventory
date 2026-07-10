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

console.log("[Worker] Starting js-ddd-inventory Outbox Worker...");
const outboxProcessor = new OutboxProcessor(outboxRepo, messageBroker);

// Start polling
const intervalMs = process.env.WORKER_INTERVAL_MS ? parseInt(process.env.WORKER_INTERVAL_MS) : 3000;
outboxProcessor.start(intervalMs);
WebhookDeliveryWorker.start(intervalMs);
console.log(`[Worker] Outbox worker started (polling every ${intervalMs}ms)`);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Worker] Shutting down outbox worker...");
  outboxProcessor.stop();
  WebhookDeliveryWorker.stop();
  if ('disconnect' in messageBroker && typeof (messageBroker as any).disconnect === 'function') {
    (messageBroker as any).disconnect().catch((err: any) => console.error("Error during broker disconnect:", err));
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[Worker] Shutting down outbox worker...");
  outboxProcessor.stop();
  WebhookDeliveryWorker.stop();
  if ('disconnect' in messageBroker && typeof (messageBroker as any).disconnect === 'function') {
    (messageBroker as any).disconnect().catch((err: any) => console.error("Error during broker disconnect:", err));
  }
  process.exit(0);
});
