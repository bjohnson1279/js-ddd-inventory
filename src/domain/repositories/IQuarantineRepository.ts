import { QuarantineItem } from "../returns/aggregates/QuarantineItem";

export interface IQuarantineRepository {
  findById(id: string): Promise<QuarantineItem | null>;
  findAll(): Promise<QuarantineItem[]>;
  save(item: QuarantineItem): Promise<void>;
}
