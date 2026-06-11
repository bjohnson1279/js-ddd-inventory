import { RMA } from "../returns/aggregates/RMA";

export interface IRMARepository {
  findById(id: string): Promise<RMA | null>;
  findByNumber(rmaNumber: string): Promise<RMA | null>;
  findAll(): Promise<RMA[]>;
  save(rma: RMA): Promise<void>;
}
