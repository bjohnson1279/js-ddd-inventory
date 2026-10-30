const workflowStore = new Map<string, any>();
const requestStore = new Map<string, any>();
const decisionStore = new Map<string, any>();

jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    approvalDecisionModel: {
      deleteMany: jest.fn(async () => { decisionStore.clear(); }),
    },
    approvalRequestModel: {
      deleteMany: jest.fn(async () => { requestStore.clear(); }),
      create: jest.fn(async (args: any) => {
        const item = { decisions: [], ...args.data };
        requestStore.set(args.data.id, item);
        return item;
      }),
      findUnique: jest.fn(async (args: any) => {
        const req = requestStore.get(args.where.id);
        if (!req) return null;
        const workflow = workflowStore.get(req.workflowId) || null;
        return { ...req, workflow, decisions: req.decisions || [] };
      }),
      findFirst: jest.fn(async (args: any) => {
        const req = requestStore.get(args.where.id);
        if (!req) return null;
        const workflow = workflowStore.get(req.workflowId) || null;
        return { ...req, workflow, decisions: req.decisions || [] };
      }),
      findMany: jest.fn(async () => {
        return Array.from(requestStore.values()).map(req => {
          const workflow = workflowStore.get(req.workflowId) || null;
          return { ...req, workflow, decisions: req.decisions || [] };
        });
      }),
    },
    approvalWorkflowModel: {
      deleteMany: jest.fn(async () => { workflowStore.clear(); }),
      create: jest.fn(async (args: any) => {
        workflowStore.set(args.data.id, args.data);
        return args.data;
      }),
      findMany: jest.fn(async () => {
        return Array.from(workflowStore.values());
      }),
    },
    $disconnect: jest.fn(),
  },
}));

process.env.ENCRYPTION_KEY = "test_encryption_key";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "dummy_test_secret";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";

import request from "supertest";
import jwt from "jsonwebtoken";
import { app, setupApp } from "../../../src/index";
import { randomUUID } from "crypto";

const getAdminToken = () => {
  const JWT_SECRET = process.env.JWT_SECRET || "dummy_test_secret";
  return jwt.sign({ actorId: "admin-user", role: "admin", tenantId: "tenant-1" }, JWT_SECRET);
};

describe("Approval E2E Integration Test Suite", () => {
  beforeEach(async () => {
    workflowStore.clear();
    requestStore.clear();
    decisionStore.clear();

    setupApp(
      {} as any, {} as any, {} as any, {} as any, {} as any,
      {} as any, {} as any, {} as any, {} as any, {} as any,
      {} as any, {} as any, {} as any, {} as any, {} as any,
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any
    );
    await app.ready();
  });

  it("should list workflows and get an approval request", async () => {
    const token = getAdminToken();
    const workflowId = randomUUID();
    const requestId = randomUUID();

    const { prisma } = require("../../../src/infrastructure/database/prisma");

    await prisma.approvalWorkflowModel.create({
      data: {
        id: workflowId,
        tenantId: "tenant-1",
        name: "Test Workflow",
        triggerEvent: "TestEvent",
        config: JSON.stringify({ steps: [{ name: "step1", approverRoles: ["admin"], timeoutHours: 24 }] })
      }
    });

    await prisma.approvalRequestModel.create({
      data: {
        id: requestId,
        tenantId: "tenant-1",
        workflowId: workflowId,
        referenceType: "ORDER",
        referenceId: "order-1",
        requesterId: "user-1",
        payload: JSON.stringify({ amount: 100 }),
        status: "PENDING",
        currentStep: 0,
      }
    });

    const getRes = await request((app as any).server)
      .get(`/api/approvals/${requestId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(requestId);
    expect(getRes.body.workflowId).toBe(workflowId);
  });
});
