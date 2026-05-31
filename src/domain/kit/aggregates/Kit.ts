import { SKU } from "../../valueObjects/SKU";
import { KitComponent } from "../valueObjects/KitComponent";

export class Kit {
  private _components: KitComponent[] = [];

  constructor(
    public readonly id: string,
    public readonly sku: SKU,
    public readonly name: string
  ) {}

  public addComponent(variantId: string, quantity: number): void {
    for (let i = 0; i < this._components.length; i++) {
      if (this._components[i].variantId === variantId) {
        this._components[i] = new KitComponent(
          variantId,
          this._components[i].quantity + quantity
        );
        return;
      }
    }

    this._components.push(new KitComponent(variantId, quantity));
  }

  public get components(): KitComponent[] {
    return [...this._components];
  }

  public isEmpty(): boolean {
    return this._components.length === 0;
  }
}
