import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { PrismaInventoryRepository } from "./infrastructure/database/PrismaInventoryRepository";
import { PrismaBarcodeRepository } from "./infrastructure/database/PrismaBarcodeRepository";
import { PrismaSerializedItemRepository } from "./infrastructure/database/PrismaSerializedItemRepository";
import { PrismaCostLayerRepository } from "./infrastructure/database/PrismaCostLayerRepository";
import { PrismaJournalRepository } from "./infrastructure/database/PrismaJournalRepository";
import { PostgresInventoryRepository } from "./infrastructure/database/PostgresInventoryRepository";
import { IInventoryRepository } from "./domain/repositories/IInventoryRepository";
import inventoryRoutes from "./infrastructure/http/routes/inventory.routes";
import shopifyRoutes from "./infrastructure/http/routes/shopify.routes";
import onboardingRoutes from "./infrastructure/http/routes/onboarding.routes";
import { DomainEventDispatcher } from "./domain/events/DomainEventDispatcher";
import { alertPurchasingOnStockDepleted } from "./application/eventHandlers/AlertPurchasingOnStockDepleted";
import { syncJournalToQuickBooks } from "./application/eventHandlers/SyncJournalToQuickBooks";

import { IBarcodeRepository } from "./domain/repositories/IBarcodeRepository";
import { ISerializedItemRepository } from "./domain/repositories/ISerializedItemRepository";
import { ICostLayerRepository } from "./domain/repositories/ICostLayerRepository";
import { IJournalRepository } from "./domain/repositories/IJournalRepository";
import { ITenantConfigRepository } from "./domain/repositories/ITenantConfigRepository";
import { IProcessedWebhookRepository } from "./domain/repositories/IProcessedWebhookRepository";
import { IOutboxRepository } from "./domain/repositories/IOutboxRepository";

import { InMemoryBarcodeRepository } from "./infrastructure/database/InMemoryBarcodeRepository";
import { InMemorySerializedItemRepository } from "./infrastructure/database/InMemorySerializedItemRepository";
import { InMemoryCostLayerRepository } from "./infrastructure/database/InMemoryCostLayerRepository";
import { InMemoryJournalRepository } from "./infrastructure/database/InMemoryJournalRepository";
import { InMemoryTenantConfigRepository } from "./infrastructure/database/InMemoryTenantConfigRepository";
import { PrismaTenantConfigRepository } from "./infrastructure/database/PrismaTenantConfigRepository";
import { InMemoryProcessedWebhookRepository } from "./infrastructure/database/InMemoryProcessedWebhookRepository";
import { PrismaProcessedWebhookRepository } from "./infrastructure/database/PrismaProcessedWebhookRepository";
import { InMemoryOutboxRepository } from "./infrastructure/database/InMemoryOutboxRepository";
import { PrismaOutboxRepository } from "./infrastructure/database/PrismaOutboxRepository";
import { OutboxProcessor } from "./infrastructure/outbox/OutboxProcessor";

import barcodeRoutes from "./infrastructure/http/routes/barcode.routes";
import serialRoutes from "./infrastructure/http/routes/serial.routes";
import kitRoutes from "./infrastructure/http/routes/kit.routes";
import accountingRoutes from "./infrastructure/http/routes/accounting.routes";

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map(url => url.trim().replace(/\/$/, ""))
  : ["http://localhost:3000"];

const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS) : 15 * 60 * 1000, // 15 minutes default
  limit: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 100, // Limit each IP to 100 requests per `window` default
  standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.set("trust proxy", 1);
app.use(limiter);
app.use("/api/shopify", express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.json());

// Register Domain Event Handlers
DomainEventDispatcher.register("StockDepletedEvent", alertPurchasingOnStockDepleted);
DomainEventDispatcher.register("JournalEntryCreatedEvent", syncJournalToQuickBooks);

// Define setup function so E2E tests can configure app with custom repository
export const setupApp = (
  inventoryRepository: IInventoryRepository,
  barcodeRepository?: IBarcodeRepository,
  serializedItemRepository?: ISerializedItemRepository,
  costLayerRepository?: ICostLayerRepository,
  journalRepository?: IJournalRepository,
  tenantConfigRepository?: ITenantConfigRepository,
  processedWebhookRepository?: IProcessedWebhookRepository,
  outboxRepository?: IOutboxRepository
) => {
  app.set("inventoryRepository", inventoryRepository);
  app.set("barcodeRepository", barcodeRepository || new InMemoryBarcodeRepository());
  app.set("serializedItemRepository", serializedItemRepository || new InMemorySerializedItemRepository());
  app.set("costLayerRepository", costLayerRepository || new InMemoryCostLayerRepository());
  app.set("journalRepository", journalRepository || new InMemoryJournalRepository());
  app.set("tenantConfigRepository", tenantConfigRepository || new InMemoryTenantConfigRepository());
  app.set("processedWebhookRepository", processedWebhookRepository || new InMemoryProcessedWebhookRepository());
  app.set("outboxRepository", outboxRepository || new InMemoryOutboxRepository());
  
  // Legacy key for backwards compatibility
  app.set("repository", inventoryRepository);

  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/barcodes", barcodeRoutes);
  app.use("/api/serials", serialRoutes);
  app.use("/api/kits", kitRoutes);
  app.use("/api/accounting", accountingRoutes);
  app.use("/api/shopify", shopifyRoutes);
  app.use("/api/onboarding", onboardingRoutes);
};

const start = async () => {
  let repository: IInventoryRepository;

  if (process.env.DB_HOST) {
    console.log("Initializing PostgreSQL Repository...");
    const pgRepo = new PostgresInventoryRepository({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "5432"),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    await pgRepo.initialize();
    repository = pgRepo;
  } else {
    console.log("Initializing Prisma Repository (SQLite)...");
    repository = new PrismaInventoryRepository(new PrismaOutboxRepository());
  }

  const barcodeRepo = new PrismaBarcodeRepository();
  const serialRepo = new PrismaSerializedItemRepository();
  const costLayerRepo = new PrismaCostLayerRepository();
  const outboxRepo = new PrismaOutboxRepository();
  const journalRepo = new PrismaJournalRepository(outboxRepo);
  const tenantConfigRepo = new PrismaTenantConfigRepository();
  const processedWebhookRepo = new PrismaProcessedWebhookRepository();

  setupApp(repository, barcodeRepo, serialRepo, costLayerRepo, journalRepo, tenantConfigRepo, processedWebhookRepo, outboxRepo);

  const outboxProcessor = new OutboxProcessor(outboxRepo);
  outboxProcessor.start(3000);

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};

if (process.env.NODE_ENV !== "test") {
  start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

export { app };

