import request from "supertest";
import express from "express";

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

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  (req as any).tenantId = "test-tenant";
  next();
});
app.use("/api/approvals", approvalRoutes);

describe("Approval Routes", () => {
  it("should toggle a workflow", async () => {
    const res = await request(app).post("/api/approvals/workflows/wf-1/toggle");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "wf-1", isActive: true });
  });
});
