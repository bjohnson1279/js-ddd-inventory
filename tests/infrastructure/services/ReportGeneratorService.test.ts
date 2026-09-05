import { ReportGeneratorService } from "../../../src/infrastructure/services/ReportGeneratorService";
import { prisma } from "../../../src/infrastructure/database/prisma";
import { FileStorageService } from "../../../src/infrastructure/services/FileStorageService";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { format as formatCsv } from "fast-csv";
import { Writable } from "stream";

// Mock dependencies
jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    reportDefinitionModel: {
      findUnique: jest.fn(),
    },
    inventoryModel: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("../../../src/infrastructure/services/FileStorageService", () => {
  return {
    FileStorageService: jest.fn().mockImplementation(() => {
      return {
        getFilePath: jest.fn().mockImplementation((filename) => `/mock/path/${filename}`),
        getWriteStream: jest.fn().mockImplementation(() => {
          const stream = new Writable({
            write(chunk, encoding, callback) {
              callback();
            }
          });
          // simulate async finish event
          setTimeout(() => {
             stream.emit('finish');
          }, 10);
          return stream;
        }),
      };
    })
  };
});

jest.mock("exceljs", () => {
  const mockWorksheet = {
    columns: [],
    addRow: jest.fn(),
  };
  const mockWorkbook = {
    addWorksheet: jest.fn().mockReturnValue(mockWorksheet),
    xlsx: {
      writeFile: jest.fn().mockResolvedValue(undefined),
    },
  };
  return {
    Workbook: jest.fn().mockReturnValue(mockWorkbook),
  };
});

jest.mock("pdfkit", () => {
  return jest.fn().mockImplementation(() => ({
    pipe: jest.fn(),
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    end: jest.fn(),
  }));
});

describe("ReportGeneratorService", () => {
  let reportGeneratorService: ReportGeneratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    reportGeneratorService = new ReportGeneratorService();
  });

  it("should throw an error if report definition is not found", async () => {
    (prisma.reportDefinitionModel.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(reportGeneratorService.generateReport("non-existent-id", "exec-1", "csv")).rejects.toThrow("Report definition not found");
  });

  it("should generate a CSV report for INVENTORY_VALUATION", async () => {
    (prisma.reportDefinitionModel.findUnique as jest.Mock).mockResolvedValue({
      id: "report-1",
      type: "INVENTORY_VALUATION",
    });
    (prisma.inventoryModel.findMany as jest.Mock).mockResolvedValue([
      { sku: "SKU1", quantity: 10, locationId: "LOC1" },
    ]);

    const result = await reportGeneratorService.generateReport("report-1", "exec-1", "csv");

    expect(result).toMatch(/\/uploads\/reports\/inventory_valuation_exec-1.csv/);
    expect(prisma.reportDefinitionModel.findUnique).toHaveBeenCalledWith({ where: { id: "report-1" } });
    expect(prisma.inventoryModel.findMany).toHaveBeenCalledWith({ take: 100 });
  });

  it("should generate an XLSX report with empty data if type is not INVENTORY_VALUATION", async () => {
    (prisma.reportDefinitionModel.findUnique as jest.Mock).mockResolvedValue({
      id: "report-2",
      type: "OTHER_TYPE",
    });

    const result = await reportGeneratorService.generateReport("report-2", "exec-2", "xlsx");

    expect(result).toMatch(/\/uploads\/reports\/other_type_exec-2.xlsx/);
    expect(prisma.inventoryModel.findMany).not.toHaveBeenCalled();
  });

  it("should generate a PDF report", async () => {
    (prisma.reportDefinitionModel.findUnique as jest.Mock).mockResolvedValue({
      id: "report-3",
      type: "INVENTORY_VALUATION",
    });
    (prisma.inventoryModel.findMany as jest.Mock).mockResolvedValue([
      { sku: "SKU2", quantity: 20, locationId: "LOC2" },
    ]);

    const result = await reportGeneratorService.generateReport("report-3", "exec-3", "pdf");

    expect(result).toMatch(/\/uploads\/reports\/inventory_valuation_exec-3.pdf/);
  });

  it("should throw an error for unsupported format", async () => {
    (prisma.reportDefinitionModel.findUnique as jest.Mock).mockResolvedValue({
      id: "report-4",
      type: "INVENTORY_VALUATION",
    });

    await expect(reportGeneratorService.generateReport("report-4", "exec-4", "txt")).rejects.toThrow("Unsupported format: txt");
  });
});
