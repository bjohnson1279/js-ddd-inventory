process.env.NODE_ENV = "test";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";

import request from "supertest";
import { app, setupApp } from "../../../src/index";
import { prisma } from "../../../src/infrastructure/database/prisma";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";

describe("Authentication & Multi-Tenant RBAC E2E Tests", () => {
  let repository: InMemoryInventoryRepository;

  beforeEach(async () => {
    repository = new InMemoryInventoryRepository();
    setupApp(repository);

    // Clean up authentication tables
    await prisma.userRoleModel.deleteMany();
    await prisma.userModel.deleteMany();
    await prisma.tenantModel.deleteMany();
    await prisma.roleModel.deleteMany();
  });

  it("should setup a new organization and admin user", async () => {
    const res = await request(app)
      .post("/api/auth/setup")
      .send({
        orgName: "Acme Retail",
        tenantId: "tenant-acme",
        adminName: "Alice Admin",
        adminEmail: "alice@acme.com",
        adminPassword: "Password123!"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const user = await prisma.userModel.findFirst({
      where: { tenantId: "tenant-acme", email: "alice@acme.com" }
    });
    expect(user).toBeDefined();
    expect(user?.name).toBe("Alice Admin");
  });

  it("should issue a JWT on successful login", async () => {
    // 1. Setup organization first
    await request(app)
      .post("/api/auth/setup")
      .send({
        orgName: "Acme Retail",
        tenantId: "tenant-acme",
        adminName: "Alice Admin",
        adminEmail: "alice@acme.com",
        adminPassword: "Password123!"
      });

    // 2. Perform login
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        tenantId: "tenant-acme",
        email: "alice@acme.com",
        password: "Password123!"
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();

    // 3. Try to access inventory using the JWT token
    const inventoryRes = await request(app)
      .get("/api/inventory")
      .set("Authorization", `Bearer ${res.body.token}`);

    expect(inventoryRes.status).toBe(200);
  });

  it("should fail login with incorrect credentials", async () => {
    await request(app)
      .post("/api/auth/setup")
      .send({
        orgName: "Acme Retail",
        tenantId: "tenant-acme",
        adminName: "Alice Admin",
        adminEmail: "alice@acme.com",
        adminPassword: "Password123!"
      });

    const res = await request(app)
      .post("/api/auth/login")
      .send({
        tenantId: "tenant-acme",
        email: "alice@acme.com",
        password: "WrongPassword!"
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/credentials/i);
  });

  it("should enforce authorization token outside of test environment", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const res = await request(app).get("/api/inventory");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/token/i);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
