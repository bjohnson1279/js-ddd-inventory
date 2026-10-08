import request from "supertest";
import fastify from "fastify";

jest.mock("../../../../src/application/useCases/ManageApprovalWorkflowsUseCase", () => {
  return {
    ManageApprovalWorkflowsUseCase: jest.fn().mockImplementation(() => {
      return {
        toggleWorkflow: jest.fn().mockResolvedValue({ id: "wf-1", isActive: true })
      };
    })
  };
});

jest.mock("../../../../src/infrastructure/http/middleware/auth", () => {
  return {
    requirePermission: jest.fn().mockImplementation((resource, action) => {
      return (req: any, res: any, next: any) => next();
    })
  };
});

import approvalRoutes from "../../../../src/infrastructure/http/routes/approval.routes";

const app = fastify();

app.addHook("preHandler", (req, res, next) => {
  (req as any).tenantId = "test-tenant";
  next();
});
app.register(approvalRoutes, { prefix: "/api/approvals" });


describe("Approval Routes", () => {
  beforeAll(async () => {
    await app.ready();
  });

  it("should toggle a workflow", async () => {
    const res = await request((app as any).server).post("/api/approvals/workflows/wf-1/toggle");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "wf-1", isActive: true });
  });
});
