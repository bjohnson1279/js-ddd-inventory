export interface ASN {
  id: string;
  asnNumber: string;
  supplierId: string;
  expectedDelivery: Date;
  actualDelivery: Date | null;
  status: 'IN_TRANSIT' | 'DELIVERED' | 'DELAYED';
  createdAt: Date;
}
