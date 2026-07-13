import { CalculateShippingRates } from "../../../src/application/useCases/CalculateShippingRates";
import { ICarrierService } from "../../../src/application/ports/ICarrierService";

describe("CalculateShippingRates Use Case", () => {
  let mockCarrierService: jest.Mocked<ICarrierService>;
  let useCase: CalculateShippingRates;

  beforeEach(() => {
    mockCarrierService = {
      fetchRates: jest.fn(),
      generateLabel: jest.fn(),
    };
    useCase = new CalculateShippingRates(mockCarrierService);
  });

  it("should fetch rates successfully when all required fields are provided", async () => {
    const mockRates = [
      { carrier: "FedEx", rateCents: 1500, estimatedDays: 3 },
      { carrier: "UPS", rateCents: 1200, estimatedDays: 5 }
    ];
    mockCarrierService.fetchRates.mockResolvedValue(mockRates);

    const result = await useCase.execute({
      sku: "SKU-123",
      quantity: 2,
      destinationAddress: "123 Main St"
    });

    expect(result).toEqual(mockRates);
    expect(mockCarrierService.fetchRates).toHaveBeenCalledWith("SKU-123", 2, "123 Main St");
    expect(mockCarrierService.fetchRates).toHaveBeenCalledTimes(1);
  });

  it("should throw an error if sku is missing", async () => {
    await expect(
      useCase.execute({
        sku: "",
        quantity: 1,
        destinationAddress: "123 Main St"
      })
    ).rejects.toThrow("Missing required rate fields: sku and destinationAddress.");

    expect(mockCarrierService.fetchRates).not.toHaveBeenCalled();
  });

  it("should throw an error if destinationAddress is missing", async () => {
    await expect(
      useCase.execute({
        sku: "SKU-123",
        quantity: 1,
        destinationAddress: ""
      })
    ).rejects.toThrow("Missing required rate fields: sku and destinationAddress.");

    expect(mockCarrierService.fetchRates).not.toHaveBeenCalled();
  });

  it("should propagate errors thrown by the carrierService", async () => {
    const error = new Error("Carrier API down");
    mockCarrierService.fetchRates.mockRejectedValue(error);

    await expect(
      useCase.execute({
        sku: "SKU-123",
        quantity: 1,
        destinationAddress: "123 Main St"
      })
    ).rejects.toThrow("Carrier API down");

    expect(mockCarrierService.fetchRates).toHaveBeenCalledWith("SKU-123", 1, "123 Main St");
  });

  it("should throw an error if sku is null or undefined at runtime", async () => {
    await expect(
      useCase.execute({
        sku: null as any,
        quantity: 1,
        destinationAddress: "123 Main St"
      })
    ).rejects.toThrow("Missing required rate fields: sku and destinationAddress.");

    await expect(
      useCase.execute({
        sku: undefined as any,
        quantity: 1,
        destinationAddress: "123 Main St"
      })
    ).rejects.toThrow("Missing required rate fields: sku and destinationAddress.");

    expect(mockCarrierService.fetchRates).not.toHaveBeenCalled();
  });

  it("should throw an error if destinationAddress is null or undefined at runtime", async () => {
    await expect(
      useCase.execute({
        sku: "SKU-123",
        quantity: 1,
        destinationAddress: null as any
      })
    ).rejects.toThrow("Missing required rate fields: sku and destinationAddress.");

    await expect(
      useCase.execute({
        sku: "SKU-123",
        quantity: 1,
        destinationAddress: undefined as any
      })
    ).rejects.toThrow("Missing required rate fields: sku and destinationAddress.");

    expect(mockCarrierService.fetchRates).not.toHaveBeenCalled();
  });

  it("should propagate network timeout errors thrown by the carrierService", async () => {
    const error = new Error("Network timeout");
    error.name = "TimeoutError";
    mockCarrierService.fetchRates.mockRejectedValue(error);

    await expect(
      useCase.execute({
        sku: "SKU-123",
        quantity: 1,
        destinationAddress: "123 Main St"
      })
    ).rejects.toThrow("Network timeout");
  });

  it("should handle the carrierService returning an empty array when no rates are available", async () => {
    mockCarrierService.fetchRates.mockResolvedValue([]);

    const result = await useCase.execute({
      sku: "SKU-123",
      quantity: 1,
      destinationAddress: "No Service Island"
    });

    expect(result).toEqual([]);
    expect(mockCarrierService.fetchRates).toHaveBeenCalledWith("SKU-123", 1, "No Service Island");
  });

  it("should pass negative or zero quantities through to the carrierService", async () => {
    const mockRates = [{ carrier: "FedEx", rateCents: 1500, estimatedDays: 3 }];
    mockCarrierService.fetchRates.mockResolvedValue(mockRates);

    const result = await useCase.execute({
      sku: "SKU-123",
      quantity: -5,
      destinationAddress: "123 Main St"
    });

    expect(result).toEqual(mockRates);
    expect(mockCarrierService.fetchRates).toHaveBeenCalledWith("SKU-123", -5, "123 Main St");
  });

});
