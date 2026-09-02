import { IntercompanyTransferService } from '../../../src/domain/accounting/services/IntercompanyTransferService';
import { AccountCode } from '../../../src/domain/accounting/valueObjects/AccountCode';
import { DebitCredit } from '../../../src/domain/accounting/enums/DebitCredit';

describe('IntercompanyTransferService', () => {
  let service: IntercompanyTransferService;

  beforeEach(() => {
    service = new IntercompanyTransferService();
  });

  it('should create an intercompany transfer with 0 markup and 0 duty', () => {
    const { transfer, standardJournal, eliminationJournal } = service.executeTransfer(
      'tenant-1',
      'entity-A',
      'entity-B',
      'SKU-123',
      10, // quantity
      1000, // 10.00 unit cost
      0.0, // 0% markup
      0 // 0 duty
    );

    expect(transfer.tenantId).toBe('tenant-1');
    expect(transfer.fromEntityId).toBe('entity-A');
    expect(transfer.toEntityId).toBe('entity-B');
    expect(transfer.quantity).toBe(10);
    expect(transfer.transferPriceCents).toBe(10000); // 10 * 1000
    expect(transfer.status).toBe('COMPLETED');
    expect(transfer.journalEntryId).toBe(standardJournal.id);

    expect(standardJournal.lines.length).toBe(6);
    
    // Entity A Side
    const cogsLine = standardJournal.lines.find(l => l.account.code === AccountCode.intercompanyCogs().code);
    expect(cogsLine?.amountCents).toBe(10000);
    expect(cogsLine?.type).toBe(DebitCredit.Debit);

    const revLine = standardJournal.lines.find(l => l.account.code === AccountCode.intercompanyRevenue().code);
    expect(revLine?.amountCents).toBe(10000);
    expect(revLine?.type).toBe(DebitCredit.Credit);

    // Entity B Side
    const apLine = standardJournal.lines.find(l => l.account.code === AccountCode.accountsPayable().code);
    expect(apLine?.amountCents).toBe(10000);
    expect(apLine?.type).toBe(DebitCredit.Credit);

    // Elimination
    expect(eliminationJournal.lines.length).toBe(4);
    
    const elimAp = eliminationJournal.lines.find(l => l.account.code === AccountCode.accountsPayable().code);
    expect(elimAp?.amountCents).toBe(10000);
    expect(elimAp?.type).toBe(DebitCredit.Debit); // eliminate AP (credit) with debit

    const elimEquity = eliminationJournal.lines.find(l => l.account.code === AccountCode.intercompanyElimination().code);
    expect(elimEquity).toBeUndefined(); // No markup, so 0 elimination
  });

  it('should calculate transfer price with markup and duty correctly', () => {
    const { transfer, standardJournal, eliminationJournal } = service.executeTransfer(
      'tenant-1',
      'entity-A',
      'entity-B',
      'SKU-999',
      5, // quantity
      2000, // 20.00 unit cost
      0.25, // 25% markup
      500 // 5.00 duty
    );

    const totalCost = 10000;
    const markup = 2500;
    const transferPrice = 12500;

    expect(transfer.transferPriceCents).toBe(transferPrice);
    expect(transfer.dutyCents).toBe(500);

    // Standard journal should have 7 lines because of the cash duty
    expect(standardJournal.lines.length).toBe(7);

    // Entity B Inventory should be transfer price + duty
    const inventoryInflow = standardJournal.lines.find(l => l.account.code === AccountCode.inventory().code && l.type === DebitCredit.Debit);
    expect(inventoryInflow?.amountCents).toBe(13000); // 12500 + 500

    const cashCredit = standardJournal.lines.find(l => l.account.code === AccountCode.cash().code && l.type === DebitCredit.Credit);
    expect(cashCredit?.amountCents).toBe(500); // Duty paid

    // Elimination should eliminate the unrealized profit in equity
    const elimEquity = eliminationJournal.lines.find(l => l.account.code === AccountCode.intercompanyElimination().code);
    expect(elimEquity?.amountCents).toBe(2500);
    expect(elimEquity?.type).toBe(DebitCredit.Credit); // Equity credit to balance the debit difference between Rev (Debit 12500) and COGS (Credit 10000)
  });
});
