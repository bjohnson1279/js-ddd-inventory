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
});
