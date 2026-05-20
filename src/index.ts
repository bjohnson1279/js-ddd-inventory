import express from "express";
import cors from "cors";
import { InMemoryInventoryRepository } from "./infrastructure/database/InMemoryInventoryRepository";
import { PostgresInventoryRepository } from "./infrastructure/database/PostgresInventoryRepository";
import { IInventoryRepository } from "./domain/repositories/IInventoryRepository";
import inventoryRoutes from "./infrastructure/http/routes/inventory.routes";
import shopifyRoutes from "./infrastructure/http/routes/shopify.routes";
import onboardingRoutes from "./infrastructure/http/routes/onboarding.routes";

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
    console.log("Initializing In-Memory Repository...");
    repository = new InMemoryInventoryRepository();
  }

  // Inject repository into app for routes to use (simple way given the current structure)
  app.set("repository", repository);

  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/shopify", shopifyRoutes);
  app.use("/api/onboarding", onboardingRoutes);

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
