export class RejectRMAItemDTO {
  constructor(
    public readonly itemId: string,
    public readonly reason: string
  ) {}
}