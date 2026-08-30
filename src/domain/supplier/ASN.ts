export interface ASNLine {
  sku: string;
  quantity: number;
}

export interface ASN {
  id: string;
  tenantId: string;
  poId: string;
  supplierId: string;
  expectedArrivalDate: Date;
  status: 'SUBMITTED' | 'RECEIVED' | 'DISCREPANCY';
  lines: ASNLine[];
}
