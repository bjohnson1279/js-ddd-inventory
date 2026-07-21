import { prisma } from "../src/infrastructure/database/prisma";
import { WebhookDeliveryWorker } from "../src/infrastructure/workers/WebhookDeliveryWorker";

async function runBenchmark() {
  console.log("Setting up benchmark data...");

  // Clean up any existing data
  await prisma.webhookDeliveryModel.deleteMany({});
  await prisma.webhookSubscriptionModel.deleteMany({});

  // Seed subscriptions
  const NUM_SUBSCRIPTIONS = 10;
  const subscriptions = [];
  for (let i = 0; i < NUM_SUBSCRIPTIONS; i++) {
    const sub = await prisma.webhookSubscriptionModel.create({
      data: {
        id: `sub-${i}`,
        targetUrl: `https://example.com/webhook-${i}`,
        secret: "super-secret",
        isActive: true,
        tenantId: "tenant-1"
      }
    });
    subscriptions.push(sub);
  }

  // Seed pending deliveries (10 is the batch size in WebhookDeliveryWorker)
  const BATCH_SIZE = 10;
  for (let i = 0; i < BATCH_SIZE; i++) {
    await prisma.webhookDeliveryModel.create({
      data: {
        id: `del-${i}`,
        subscriptionId: `sub-${i % NUM_SUBSCRIPTIONS}`, // Mix them up
        eventType: "TestEvent",
        payload: JSON.stringify({ message: "Hello World" }),
        status: "Pending",
        attempts: 0,
        nextAttemptAt: new Date(Date.now() - 10000), // In the past so it gets picked up
        tenantId: "tenant-1"
      }
    });
  }

  // Mock global fetch
  const originalFetch = global.fetch;
  (global as any).fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({})
  });

  // Since we use dns.lookup inside isSafeUrl, we need to mock it as well to avoid delays or failures
  const dns = require("dns/promises");
  const originalLookup = dns.lookup;
  dns.lookup = async () => ({ address: "93.184.216.34" });

  console.log("Starting baseline benchmark...");

  // Run it a few times to get a better average, but for now we'll just run it multiple iterations
  // Actually, WebhookDeliveryWorker.processPendingDeliveries takes only up to 10 deliveries per run.
  // We'll run it 100 times to get a measurable difference.

  // Let's seed more deliveries to be safe
  console.log("Seeding more deliveries for a longer benchmark...");
  await prisma.webhookDeliveryModel.deleteMany({});
  const NUM_RUNS = 20;
  for (let r = 0; r < NUM_RUNS; r++) {
      for (let i = 0; i < BATCH_SIZE; i++) {
        await prisma.webhookDeliveryModel.create({
          data: {
            id: `del-${r}-${i}`,
            subscriptionId: `sub-${i % NUM_SUBSCRIPTIONS}`,
            eventType: "TestEvent",
            payload: JSON.stringify({ message: "Hello World" }),
            status: "Pending",
            attempts: 0,
            nextAttemptAt: new Date(Date.now() - 10000),
            tenantId: "tenant-1"
          }
        });
      }
  }

  const start = performance.now();

  for(let i=0; i<NUM_RUNS; i++) {
      await WebhookDeliveryWorker.processPendingDeliveries();
  }

  const end = performance.now();
  const duration = end - start;

  console.log(`⏱️ WebhookDeliveryWorker.processPendingDeliveries() (100 deliveries total) took: ${duration.toFixed(2)}ms`);

  // Restore mocks
  (global as any).fetch = originalFetch;
  dns.lookup = originalLookup;

  await prisma.$disconnect();
}

runBenchmark().catch(console.error);
