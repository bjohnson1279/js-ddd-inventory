process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "dummy_test_secret";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";
process.env.COMPLIANCE_PRIVATE_KEY = "dummy_compliance_key";

import request from "supertest";
import { app, setupApp } from "../../../src/index";
import { prisma } from "../../../src/infrastructure/database/prisma";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { ComplianceLedgerService } from "../../../src/domain/services/ComplianceLedgerService";
import jwt from "jsonwebtoken";

describe("Compliance Ledger E2E Tests", () => {
  let repository: InMemoryInventoryRepository;
  let adminToken: string;

  beforeAll(async () => {
    // Generate valid admin token
    adminToken = jwt.sign(
      { userId: "admin-user", role: "admin", tenantId: "tenant-acme" },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );
  });

  beforeEach(async () => {
    repository = new InMemoryInventoryRepository();
    setupApp(repository);

    // Clean up ledger table
    await prisma.complianceLedgerModel.deleteMany();
  });

  it("should safely handle type confusion on list endpoint (array tenantId)", async () => {
    // Insert a dummy record
    await ComplianceLedgerService.logEvent("tenant-acme", "TEST_EVENT", { foo: "bar" });

    // Express may parse ?tenantId[]=1&tenantId[]=2 as an array.
    const res = await request(app)
      .get("/api/compliance/ledger?tenantId[]=1&tenantId[]=2")
      .set("Authorization", `Bearer ${adminToken}`);

    // If type confusion causes an exception (e.g. Prisma expecting a string but getting array),
    // it returns 500. It should safely ignore or handle arrays and return 200.
    expect(res.status).toBe(200);
    // Because tenantId was not a string, it defaults to undefined, so we should get the records for all (or no tenant filter).
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  it("should safely handle type confusion on verify endpoint (object tenantId)", async () => {
    await ComplianceLedgerService.logEvent("tenant-acme", "TEST_EVENT", { foo: "bar" });

    // Express may parse ?tenantId[foo]=bar as an object.
    const res = await request(app)
      .post("/api/compliance/verify?tenantId[foo]=bar")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isValid).toBe(true);
  });
});
