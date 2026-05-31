import { JournalEntry } from "../accounting/aggregates/JournalEntry";

export interface IJournalRepository {
  save(entry: JournalEntry): Promise<void>;
  findAll(tenantId?: string): Promise<JournalEntry[]>;
}
