export class KitComponent {
  constructor(
    public readonly variantId: string,
    public readonly quantity: number
  ) {
    if (quantity < 1) {
      throw new Error("Kit component quantity must be at least 1.");
    }
  }
}
