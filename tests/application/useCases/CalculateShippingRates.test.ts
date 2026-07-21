import { CalculateShippingRates, CalculateShippingRatesQuery } from "../../../src/application/useCases/CalculateShippingRates";
import { ICarrierService, CarrierRate } from "../../../src/application/ports/ICarrierService";

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

  it("should successfully fetch shipping rates from the carrier service", async () => {
    const query: CalculateShippingRatesQuery = {
      sku: "SKU-123",
      quantity: 2,
      destinationAddress: "123 Main St, Springfield, IL 62701",
    };

    const mockRates: CarrierRate[] = [
      { carrier: "FedEx", rateCents: 1500, estimatedDays: 3 },
      { carrier: "UPS", rateCents: 1200, estimatedDays: 5 },
    ];

    mockCarrierService.fetchRates.mockResolvedValue(mockRates);

    const result = await useCase.execute(query);

    expect(result).toEqual(mockRates);
    expect(mockCarrierService.fetchRates).toHaveBeenCalledTimes(1);
    expect(mockCarrierService.fetchRates).toHaveBeenCalledWith(
      query.sku,
      query.quantity,
      query.destinationAddress
    );
  });

  it("should throw an error if sku is missing", async () => {
    const query: CalculateShippingRatesQuery = {
      sku: "",
      quantity: 1,
      destinationAddress: "123 Main St",
    };

    await expect(useCase.execute(query)).rejects.toThrow(
      "Missing required rate fields: sku and destinationAddress."
    );
    expect(mockCarrierService.fetchRates).not.toHaveBeenCalled();
  });

  it("should throw an error if destinationAddress is missing", async () => {
    const query: CalculateShippingRatesQuery = {
      sku: "SKU-123",
      quantity: 1,
      destinationAddress: "",
    };

    await expect(useCase.execute(query)).rejects.toThrow(
      "Missing required rate fields: sku and destinationAddress."
    );
    expect(mockCarrierService.fetchRates).not.toHaveBeenCalled();
  });

  it("should propagate errors thrown by the carrier service", async () => {
    const query: CalculateShippingRatesQuery = {
      sku: "SKU-123",
      quantity: 1,
      destinationAddress: "123 Main St",
    };

    const serviceError = new Error("Carrier API timeout");
    mockCarrierService.fetchRates.mockRejectedValue(serviceError);

    await expect(useCase.execute(query)).rejects.toThrow("Carrier API timeout");
    expect(mockCarrierService.fetchRates).toHaveBeenCalledTimes(1);
  });

  it("should throw an error if query is missing", async () => {
    await expect(useCase.execute(null as any)).rejects.toThrow("Missing query.");
    await expect(useCase.execute(undefined as any)).rejects.toThrow("Missing query.");
    expect(mockCarrierService.fetchRates).not.toHaveBeenCalled();
  });

  it("should throw an error if sku is whitespace only", async () => {
    const query: CalculateShippingRatesQuery = {
      sku: "   ",
      quantity: 1,
      destinationAddress: "123 Main St",
    };

    await expect(useCase.execute(query)).rejects.toThrow(
      "Missing required rate fields: sku and destinationAddress."
    );
    expect(mockCarrierService.fetchRates).not.toHaveBeenCalled();
  });

  it("should throw an error if destinationAddress is whitespace only", async () => {
    const query: CalculateShippingRatesQuery = {
      sku: "SKU-123",
      quantity: 1,
      destinationAddress: "   ",
    };

    await expect(useCase.execute(query)).rejects.toThrow(
      "Missing required rate fields: sku and destinationAddress."
    );
    expect(mockCarrierService.fetchRates).not.toHaveBeenCalled();
  });

  it("should throw an error if quantity is invalid (negative or zero)", async () => {
    const query1: CalculateShippingRatesQuery = { sku: "SKU-123", quantity: 0, destinationAddress: "123 Main St" };
    const query2: CalculateShippingRatesQuery = { sku: "SKU-123", quantity: -5, destinationAddress: "123 Main St" };

    await expect(useCase.execute(query1)).rejects.toThrow("Invalid quantity.");
    await expect(useCase.execute(query2)).rejects.toThrow("Invalid quantity.");
    expect(mockCarrierService.fetchRates).not.toHaveBeenCalled();
  });

  it("should throw an error if quantity is null, undefined, or NaN", async () => {
    await expect(useCase.execute({ sku: "SKU", quantity: null as any, destinationAddress: "123" })).rejects.toThrow("Invalid quantity.");
    await expect(useCase.execute({ sku: "SKU", quantity: undefined as any, destinationAddress: "123" })).rejects.toThrow("Invalid quantity.");
    await expect(useCase.execute({ sku: "SKU", quantity: NaN, destinationAddress: "123" })).rejects.toThrow("Invalid quantity.");
    expect(mockCarrierService.fetchRates).not.toHaveBeenCalled();
  });
});
