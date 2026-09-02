<<<<<<< HEAD
import request from 'supertest';
import express from 'express';

// Mock PrismaClient to prevent initialization errors
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => {
      return {
        approvalWorkflowModel: {
          update: jest.fn().mockResolvedValue({ id: 'some-uuid', isActive: false }),
          findUnique: jest.fn().mockResolvedValue({ id: 'some-uuid', isActive: true })
        },
        approvalRequestModel: {
          findMany: jest.fn().mockResolvedValue([])
        }
      };
    })
  };
});

// Mock the auth middleware explicitly for tests
jest.mock('../../../src/infrastructure/http/middleware/auth', () => ({
  requirePermission: () => (req: any, res: any, next: any) => {
    req.tenantId = 'tenant-1';
    req.userId = 'user-1';
    next();
  }
}));

import approvalRouter from '../../../src/infrastructure/http/routes/approval.routes';

const app = express();
app.use(express.json());
app.use('/api/approvals', approvalRouter);

describe('Approval E2E', () => {
  it('should toggle a workflow', async () => {
    const res = await request(app)
      .post('/api/approvals/workflows/some-uuid/toggle');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 'some-uuid');
    expect(res.body).toHaveProperty('isActive', false);
  });

  it('should list pending requests', async () => {
    const res = await request(app)
      .get('/api/approvals/pending');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
=======
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

    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(requestId);
    expect(getRes.body.workflowId).toBe(workflowId);

>>>>>>> origin/main
  });
});
