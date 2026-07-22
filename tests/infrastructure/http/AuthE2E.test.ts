process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "dummy_test_secret";
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

  it("should fail with invalid JWT token", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const res = await request(app)
        .get("/api/inventory")
        .set("Authorization", "Bearer invalid.jwt.token");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized: Access token is missing or invalid/i);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  describe("User Management and RBAC", () => {
    let adminToken: string;

    beforeEach(async () => {
      // 1. Setup org
      await request(app)
        .post("/api/auth/setup")
        .send({
          orgName: "Acme Retail",
          tenantId: "tenant-acme",
          adminName: "Alice Admin",
          adminEmail: "alice@acme.com",
          adminPassword: "Password123!"
        });

      // 2. Login as admin
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
          tenantId: "tenant-acme",
          email: "alice@acme.com",
          password: "Password123!"
        });
      adminToken = loginRes.body.token;
    });

    it("should allow admin to invite user, list users, and update user role", async () => {
      // Invite user
      const inviteRes = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: "bob@acme.com",
          role: "viewer"
        });

      expect(inviteRes.status).toBe(201);
      expect(inviteRes.body.userId).toBeDefined();
      expect(inviteRes.body.temporaryPassword).toBeUndefined();
      const newUserId = inviteRes.body.userId;

      // List users
      const listRes = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.users).toHaveLength(2); // Admin + Bob
      const bobRecord = listRes.body.users.find((u: any) => u.email === "bob@acme.com");
      expect(bobRecord).toBeDefined();
      expect(bobRecord.role).toBe("viewer");

      // Update role
      const updateRes = await request(app)
        .patch(`/api/users/${newUserId}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          role: "accountant"
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);

      // Verify updated role
      const listRes2 = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${adminToken}`);
      const updatedBob = listRes2.body.users.find((u: any) => u.email === "bob@acme.com");
      expect(updatedBob.role).toBe("accountant");
    });

    it("should deny non-admin users from accessing user management endpoints", async () => {
      // 1. We bypass the invite workflow to directly create a viewer user and role in the database
      // since the temporary password is no longer returned in the invite response.
      const viewerId = "viewer-user-id";
      const { hashPassword } = require("../../../src/infrastructure/utils/security");
      await prisma.userModel.create({
        data: {
          id: viewerId,
          tenantId: "tenant-acme",
          email: "viewer@acme.com",
          passwordHash: hashPassword("viewerPass123"),
          name: "Viewer User",
          active: true
        }
      });
      await prisma.userRoleModel.create({
        data: {
          userId: viewerId,
          roleId: "viewer"
        }
      });

      // 2. Log in as viewer
      const viewerLoginRes = await request(app)
        .post("/api/auth/login")
        .send({
          tenantId: "tenant-acme",
          email: "viewer@acme.com",
          password: "viewerPass123"
        });
      const viewerToken = viewerLoginRes.body.token;

      // 3. Try listing users as viewer -> should fail with 403
      const listRes = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${viewerToken}`);
      expect(listRes.status).toBe(403);
      expect(listRes.body.error).toMatch(/Forbidden/i);

      // 4. Try inviting a user as viewer -> should fail with 403
      const inviteRes2 = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({
          email: "another@acme.com",
          role: "viewer"
        });
      expect(inviteRes2.status).toBe(403);

      // 5. Try updating role as viewer -> should fail with 403
      const updateRes = await request(app)
        .patch(`/api/users/some-id/role`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({
          role: "admin"
        });
      expect(updateRes.status).toBe(403);
    });
  });
});
