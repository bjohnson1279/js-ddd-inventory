process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "dummy_test_secret";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";

import request from "supertest";
import jwt from "jsonwebtoken";
import { app, setupApp } from "../../../src/index";
import { prisma } from "../../../src/infrastructure/database/prisma";
import { randomUUID } from "crypto";

const getAdminToken = () => {
  const JWT_SECRET = process.env.JWT_SECRET || "dummy_test_secret";
  return jwt.sign({ actorId: "admin-user", role: "admin", tenantId: "tenant-1" }, JWT_SECRET);
};

describe("Approval E2E Integration Test Suite", () => {
  beforeEach(async () => {
    await prisma.approvalDecisionModel.deleteMany();
    await prisma.approvalRequestModel.deleteMany();
    await prisma.approvalWorkflowModel.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should list workflows and get an approval request", async () => {
    const token = getAdminToken();
    const workflowId = randomUUID();
    const requestId = randomUUID();

    // Create workflow
    await prisma.approvalWorkflowModel.create({
      data: {
        id: workflowId,
        tenantId: "tenant-1",
        name: "Test Workflow",
        triggerEvent: "TestEvent",
        config: JSON.stringify({ steps: ["reviewer1"] })
      }
    });

    // Create request
    await prisma.approvalRequestModel.create({
      data: {
        id: requestId,
        tenantId: "tenant-1",
        workflowId: workflowId,


        status: "PENDING",
        currentStep: 0,

      }
    });

    // Get the request via API
    const getRes = await request(app)
      .get(`/api/approvals/${requestId}`)
      .set("Authorization", `Bearer ${token}`);

    console.log("Response body:", getRes.body);

    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(requestId);
    expect(getRes.body.workflowId).toBe(workflowId);

  });
});
