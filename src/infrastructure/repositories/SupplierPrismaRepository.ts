import { PrismaClient, SupplierASN } from '@prisma/client';

export class SupplierPrismaRepository {
  constructor(private prisma: PrismaClient) {}

  public async saveASN(asnData: Omit<SupplierASN, 'createdAt' | 'id'>): Promise<SupplierASN> {
    return this.prisma.supplierASN.create({
      data: asnData
    });
  }

  public async getASNsForSupplier(supplierId: string): Promise<SupplierASN[]> {
    return this.prisma.supplierASN.findMany({
      where: { supplierId }
    });
  }

  public async saveScorecard(supplierId: string, onTimeRate: number, inFullRate: number, defectRate: number, otifScore: number) {
    return this.prisma.supplierScorecard.create({
      data: {
        supplierId,
        onTimeRate,
        inFullRate,
        defectRate,
        otifScore
      }
    });
  }
}
