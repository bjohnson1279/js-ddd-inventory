import { PrismaClient } from "@prisma/client";
import { enableRowLevelSecurity, rlsTables } from "../../../src/infrastructure/database/rls";
import { Logger } from "../../../src/infrastructure/logging/logger";

jest.mock("../../../src/infrastructure/logging/logger", () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("enableRowLevelSecurity", () => {
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    };

    // Backup original rlsTables
    (global as any).originalRlsTables = [...rlsTables];
  });

  afterEach(() => {
    // Restore rlsTables
    rlsTables.length = 0;
    rlsTables.push(...(global as any).originalRlsTables);
  });

  it("should execute RLS setup for valid table and column identifiers", async () => {
    rlsTables.length = 0;
    rlsTables.push({ table: "valid_table", column: "validColumn123" });

    await enableRowLevelSecurity(mockPrisma as unknown as PrismaClient);

    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
      `ALTER TABLE "valid_table" ENABLE ROW LEVEL SECURITY;`
    );
    expect(Logger.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: "[RLS Setup Warning] Invalid table or column identifier. Skipping.",
      })
    );
  });

  it("should skip RLS setup and log a warning for invalid table identifiers", async () => {
    rlsTables.length = 0;
    rlsTables.push({ table: "invalid table name;", column: "validColumn" });

    await enableRowLevelSecurity(mockPrisma as unknown as PrismaClient);

    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(Logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        context: "RLS",
        message: "[RLS Setup Warning] Invalid table or column identifier. Skipping.",
        table: "invalid table name;",
        column: "validColumn",
      })
    );
  });

  it("should skip RLS setup and log a warning for invalid column identifiers", async () => {
    rlsTables.length = 0;
    rlsTables.push({ table: "valid_table", column: "1invalid_column" }); // Starts with number

    await enableRowLevelSecurity(mockPrisma as unknown as PrismaClient);

    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(Logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        context: "RLS",
        message: "[RLS Setup Warning] Invalid table or column identifier. Skipping.",
        table: "valid_table",
        column: "1invalid_column",
      })
    );
  });

  it("should prevent SQL injection payloads", async () => {
    rlsTables.length = 0;
    rlsTables.push({ table: "users\"; DROP TABLE users; --", column: "tenantId" });

    await enableRowLevelSecurity(mockPrisma as unknown as PrismaClient);

    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(Logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        context: "RLS",
        message: "[RLS Setup Warning] Invalid table or column identifier. Skipping.",
        table: "users\"; DROP TABLE users; --",
      })
    );
  });
});
