export interface IDomainEvent {
  readonly occurredOn: Date;
  readonly eventName: string;
  readonly [key: string]: any;
}

