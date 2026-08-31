import supertest from "supertest";
import express from "express";

// IMPORTANT: Mock PrismaClient to prevent PrismaClientInitializationError during tests.
jest.mock("@prisma/client", () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => {
      return {
        approvalWorkflowModel: {
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          findUnique: jest.fn()
        },
        approvalRequestModel: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
          update: jest.fn()
        },
        approvalDecisionModel: {
          create: jest.fn()
        }
      };
    })
  };
});

// Now we can safely import routes
import approvalRoutes from "../../../src/infrastructure/http/routes/approval.routes";

const app = express();
app.use(express.json());
app.use("/api/approvals", approvalRoutes);

describe("Approval Routes", () => {
  it("should return 403 if missing permissions", async () => {
    process.env.JWT_SECRET = "test_secret";
    const res = await supertest(app).post("/api/approvals/workflows").send({});
    expect(res.status).toBe(403);
  });
});