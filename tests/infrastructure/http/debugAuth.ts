import request from "supertest";
import { app, setupApp } from "../../src/index";
import { InMemoryInventoryRepository } from "../../src/infrastructure/database/InMemoryInventoryRepository";

async function run() {
  process.env.JWT_SECRET = "dummy_test_secret";
  setupApp(new InMemoryInventoryRepository());

  const setupRes = await request(app)
    .post("/api/auth/setup")
    .send({
      orgName: "Acme Retail",
      tenantId: "tenant-acme",
      adminName: "Alice Admin",
      adminEmail: "alice@acme.com",
      adminPassword: "Password123!"
    });
  
  console.log("Setup:", setupRes.status, setupRes.body);

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({
      tenantId: "tenant-acme",
      email: "alice@acme.com",
      password: "Password123!"
    });

  console.log("Login:", loginRes.status, loginRes.body);

  const inviteRes = await request(app)
    .post("/api/users")
    .set("Authorization", `Bearer ${loginRes.body.token}`)
    .send({
      email: "bob@acme.com",
      role: "viewer"
    });

  console.log("Invite:", inviteRes.status, inviteRes.body);
}

run().catch(console.error);
