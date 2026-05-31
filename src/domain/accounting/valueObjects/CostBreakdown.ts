export class CostBreakdown {
  constructor(
    public readonly units: number,
    public readonly totalCostCents: number
  ) {}

  public get unitCostCents(): number {
    return this.units > 0 ? Math.round(this.totalCostCents / this.units) : 0;
  }
}
