import request from "supertest";
import express from "express";
import roleRoutes from "../../../src/infrastructure/http/routes/role.routes";
import { ManageRolesUseCase } from "../../../src/application/useCases/ManageRolesUseCase";
import { AuthenticatedRequest } from "../../../src/infrastructure/http/middleware/auth";

// Mock ManageRolesUseCase
jest.mock("../../../src/application/useCases/ManageRolesUseCase", () => {
  return {
    ManageRolesUseCase: {
      listPermissions: jest.fn()
    }
  };
});

// Mock Auth Middleware to always return admin
jest.mock("../../../src/infrastructure/http/middleware/auth", () => {
  return {
    authMiddleware: (req: any, res: any, next: any) => {
      req.user = { id: "1", role: "admin", tenantId: "tenant-1" };
      req.tenantId = "tenant-1";
      next();
    },
    requireRole: (allowedRoles: string[]) => (req: any, res: any, next: any) => next(),
    requirePermission: (resource: string, action: string) => (req: any, res: any, next: any) => next()
  };
});

describe("RoleController", () => {
  const app = express();
  app.use(express.json());

  // Apply mocked auth middleware globally for tests
  app.use((req, res, next) => {
      (req as AuthenticatedRequest).user = { id: "1", role: "admin", tenantId: "tenant-1" } as any;
      (req as AuthenticatedRequest).tenantId = "tenant-1";
      next();
  });

  app.use("/api/roles", roleRoutes);

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/roles/permissions", () => {
    it("should return a list of permissions", async () => {
      const mockPermissions = [
        { id: "p1", resource: "inventory", action: "read", description: "Read inventory" },
        { id: "p2", resource: "roles", action: "write", description: "Write roles" }
      ];

      (ManageRolesUseCase.listPermissions as jest.Mock).mockResolvedValue(mockPermissions);

      const response = await request(app).get("/api/roles/permissions");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ permissions: mockPermissions });
      expect(ManageRolesUseCase.listPermissions).toHaveBeenCalledTimes(1);
    });

    it("should handle errors and return 500", async () => {
      (ManageRolesUseCase.listPermissions as jest.Mock).mockRejectedValue(new Error("Database error"));

      const response = await request(app).get("/api/roles/permissions");

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: "Internal server error" });
    });
  });
});
