import { IJournalRepository } from "../../domain/repositories/IJournalRepository";
import { JournalEntry } from "../../domain/accounting/aggregates/JournalEntry";
import { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import { JournalEntryCreatedEvent } from "../../domain/events/JournalEntryCreatedEvent";

export class InMemoryJournalRepository implements IJournalRepository {
  private readonly entries: JournalEntry[] = [];

  constructor(
    private readonly outboxRepository?: IOutboxRepository
  ) {}

  public async save(entry: JournalEntry): Promise<void> {
    this.entries.push(entry);

    if (this.outboxRepository) {
      const event = new JournalEntryCreatedEvent(
        entry.id,
        entry.tenantId,
        entry.description,
        entry.date.toISOString(),
        entry.lines.map((l) => ({
          accountCode: l.account.code,
          accountName: l.account.name,
          amountCents: l.amountCents,
          type: l.type,
          memo: l.memo || "",
        }))
      );
      await this.outboxRepository.save(event);
    }
  }

  public async findAll(tenantId?: string): Promise<JournalEntry[]> {
    if (tenantId) {
      return this.entries.filter((e) => e.tenantId === tenantId);
    }
    return [...this.entries];
  }
}
