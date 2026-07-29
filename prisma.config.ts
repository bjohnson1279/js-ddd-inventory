import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["DATABASE_URL"] || "postgresql://inventory_user:inventory_password@postgres:5432/inventory_db?schema=public",
  },
});
