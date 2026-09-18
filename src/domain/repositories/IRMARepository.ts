import { RMA } from "../returns/aggregates/RMA";

export interface RejectRMAItemDTO {
  itemId: string; // RMA item id, not variant id
  reason: string;
}

export interface RejectRMADTO {
  rmaNumber: string;
  items: RejectRMAItemDTO[];
}

interface ProcessDispositionDTO {
  itemId: string;
  disposition: string; // RESTOCK | SCRAP | QUARANTINE
}

interface TrackInspectionNotesDTO {
  itemId: string;
  notes: string; // Description of the inspection finding
}

export interface IRMARepository {
  findById(id: string): Promise<RMA | null>;
  findByNumber(rmaNumber: string): Promise<RMA | null>;
  findAll(): Promise<RMA[]>;
  save(rma: RMA): Promise<void>;
  get(rmaNumber: string): Promise<RMA | null>;
  rejectItem(itemId: string, reason: string): Promise<void>;
  updateMapping(id: string, warehouseId: string): Promise<void>;
  processDisposition(variantId: string, dto: ProcessDispositionDTO): Promise<void>;
  trackInspectionNotes(rmaNumber: string, dto: TrackInspectionNotesDTO): Promise<void>;
}