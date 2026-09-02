import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { ICarrierService } from "../ports/ICarrierService";
import { IGeocoderService } from "../ports/IGeocoderService";
import { SKU } from "../../domain/valueObjects/SKU";
import { GeoLocation } from "../../domain/valueObjects/GeoLocation";
import { OrderRoutingEngine } from "../../domain/shipping/services/OrderRoutingEngine";
import {
  IRoutingStrategy,
  MinimizeCostStrategy,
  MinimizeSplitsStrategy,
  MinimizeDistanceStrategy,
  FulfillmentPlan
} from "../../domain/shipping/strategies/RoutingStrategy";

export interface RouteOrderCommand {
  sku: string;
  quantity: number;
  destinationAddress: string;
  strategyName?: "MINIMIZE_COST" | "MINIMIZE_SPLITS" | "MINIMIZE_DISTANCE";
}

export class RouteOrder {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly carrierService: ICarrierService,
    private readonly geocoderService: IGeocoderService
  ) {}

  async execute(command: RouteOrderCommand): Promise<FulfillmentPlan> {
    const { sku, quantity, destinationAddress, strategyName } = command;

    if (!sku || !quantity || !destinationAddress) {
      throw new Error("Missing required routing parameters: sku, quantity, and destinationAddress.");
    }

    // 1. Resolve active routing strategy
    let strategy: IRoutingStrategy = new MinimizeCostStrategy();
    if (strategyName === "MINIMIZE_SPLITS") {
      strategy = new MinimizeSplitsStrategy();
    } else if (strategyName === "MINIMIZE_DISTANCE") {
      strategy = new MinimizeDistanceStrategy();
    }

    // 2. Resolve destination coordinates using mock geocoder
    const destinationGeo = this.geocoderService.geocode(destinationAddress);

    // 3. Query all stock layers for the SKU across all locations
    const skuVO = SKU.create(sku);
    const stockItems = await this.inventoryRepository.findAllBySku(skuVO);

    // 4. Map stock items to candidate locations with geocodes
    const candidates = stockItems.map(item => {
      const locationId = item.locationId;
      const geoLocation = this.getWarehouseGeoLocation(locationId);

      // Calculate available stock (on-hand - allocated)
      const availableQuantity = item.quantity.getValue() - item.allocated.getValue();

      return {
        locationId,
        availableQuantity: Math.max(0, availableQuantity),
        geoLocation
      };
    });

    // 5. Run the routing engine
    const bestPlan = await OrderRoutingEngine.routeOrder(
      sku,
      quantity,
      destinationGeo,
      candidates,
      strategy,
      async (locationId, productSku, qty) => {
        try {
          const rates = await this.carrierService.fetchRates(productSku, qty, destinationAddress, locationId);
          if (rates.length === 0) return 999999;
          return Math.min(...rates.map(r => r.rateCents));
        } catch (e) {
          return 999999;
        }
      }
    );

    return bestPlan;
  }

  private getWarehouseGeoLocation(locationId: string): GeoLocation {
    const loc = locationId.toUpperCase();
    if (loc.includes("EAST") || loc.includes("WH1") || loc.includes("NY")) {
      return GeoLocation.create(40.7306, -73.9352);
    }
    if (loc.includes("WEST") || loc.includes("WH2") || loc.includes("LA")) {
      return GeoLocation.create(34.0522, -118.2437);
    }
    if (loc.includes("CENTRAL") || loc.includes("WH3") || loc.includes("CH")) {
      return GeoLocation.create(41.8781, -87.6298);
    }
    return GeoLocation.create(39.8283, -98.5795);
  }
}
