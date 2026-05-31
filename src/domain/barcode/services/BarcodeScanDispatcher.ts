import { BarcodeRegistry } from "./BarcodeRegistry";

export enum ScanContext {
  PointOfSale = "pos",
  Receiving = "receiving",
  CycleCount = "cycle_count",
  TransferOut = "transfer_out",
  TransferIn = "transfer_in",
}

export interface IScanHandler {
  handle(variantId: string, rawScan: string, payload: any): Promise<void>;
}

export class BarcodeScanDispatcher {
  private readonly handlers: Map<ScanContext, IScanHandler> = new Map();

  constructor(private readonly registry: BarcodeRegistry) {}

  public register(context: ScanContext, handler: IScanHandler): void {
    this.handlers.set(context, handler);
  }

  public async dispatch(
    rawScan: string,
    context: ScanContext,
    payload: any = {}
  ): Promise<void> {
    // Step 1: resolve the scanned value to a variant ID
    const variantId = await this.registry.resolve(rawScan);

    // Step 2: route to the correct handler for this workflow context
    const handler = this.handlers.get(context);

    if (!handler) {
      throw new Error(`No handler registered for scan context: ${context}`);
    }

    await handler.handle(variantId, rawScan, payload);
  }
}
