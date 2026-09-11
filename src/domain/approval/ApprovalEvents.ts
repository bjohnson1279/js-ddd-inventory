import { IDomainEvent } from '../events/IDomainEvent';

export class ApprovalRequestApprovedEvent implements IDomainEvent {
  public readonly occurredOn: Date;
  public readonly eventName = 'ApprovalRequestApprovedEvent';

  constructor(
    public readonly requestId: string,
    public readonly tenantId: string,
    public readonly referenceType: string,
    public readonly referenceId: string,
    public readonly payload: Record<string, any>
  ) {
    this.occurredOn = new Date();
  }
}

export class ApprovalRequestRejectedEvent implements IDomainEvent {
  public readonly occurredOn: Date;
  public readonly eventName = 'ApprovalRequestRejectedEvent';

  constructor(
    public readonly requestId: string,
    public readonly tenantId: string,
    public readonly referenceType: string,
    public readonly referenceId: string,
    public readonly payload: Record<string, any>
  ) {
    this.occurredOn = new Date();
  }
}
