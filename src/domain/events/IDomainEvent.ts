export interface IDomainEvent {
  readonly occurredOn: Date;
  readonly eventName: string;
}
