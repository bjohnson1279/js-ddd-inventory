import { Request, Response } from "express";
import { ComplianceController } from "../../../../src/infrastructure/http/controllers/ComplianceController";
import { prisma } from "../../../../src/infrastructure/database/prisma";
import { ComplianceLedgerService } from "../../../../src/domain/services/ComplianceLedgerService";

jest.mock("../../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    complianceLedgerModel: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

jest.mock("../../../../src/domain/services/ComplianceLedgerService", () => ({
  ComplianceLedgerService: {
    validateLedger: jest.fn().mockResolvedValue({ valid: true }),
  },
}));

describe("ComplianceController", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = {
      query: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe("list", () => {
    it("should process string tenantId correctly", async () => {
      mockReq.query = { tenantId: "tenant-123" };
      await ComplianceController.list(mockReq as Request, mockRes as Response);

      expect(prisma.complianceLedgerModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "tenant-123" },
        })
      );
    });

    it("should ignore object tenantId to prevent parameter pollution", async () => {
      mockReq.query = { tenantId: { not: "tenant-123" } } as any;
      await ComplianceController.list(mockReq as Request, mockRes as Response);

      expect(prisma.complianceLedgerModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: undefined,
        })
      );
    });

    it("should ignore array tenantId to prevent parameter pollution", async () => {
      mockReq.query = { tenantId: ["tenant-123", "tenant-456"] } as any;
      await ComplianceController.list(mockReq as Request, mockRes as Response);

      expect(prisma.complianceLedgerModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: undefined,
        })
      );
    });
  });

  describe("verify", () => {
    it("should process string tenantId correctly", async () => {
      mockReq.query = { tenantId: "tenant-123" };
      await ComplianceController.verify(mockReq as Request, mockRes as Response);

      expect(ComplianceLedgerService.validateLedger).toHaveBeenCalledWith("tenant-123");
    });

    it("should ignore object tenantId to prevent parameter pollution", async () => {
      mockReq.query = { tenantId: { not: "tenant-123" } } as any;
      await ComplianceController.verify(mockReq as Request, mockRes as Response);

      expect(ComplianceLedgerService.validateLedger).toHaveBeenCalledWith(undefined);
    });

    it("should ignore array tenantId to prevent parameter pollution", async () => {
      mockReq.query = { tenantId: ["tenant-123", "tenant-456"] } as any;
      await ComplianceController.verify(mockReq as Request, mockRes as Response);

      expect(ComplianceLedgerService.validateLedger).toHaveBeenCalledWith(undefined);
    });
  });
});
