import { PrismaJournalRepository } from '../PrismaJournalRepository';
import { prisma } from '../prisma';
import { JournalEntry } from '../../../domain/accounting/aggregates/JournalEntry';
import { AccountCode } from '../../../domain/accounting/valueObjects/AccountCode';
import { AccountCategory } from '../../../domain/accounting/enums/AccountCategory';
import { DebitCredit } from '../../../domain/accounting/enums/DebitCredit';
import { AccountingMethod } from '../../../domain/accounting/enums/AccountingMethod';
import { IOutboxRepository } from '../../../domain/repositories/IOutboxRepository';

jest.mock('../prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    journalEntryModel: {
      findMany: jest.fn(),
    },
  },
}));

describe('PrismaJournalRepository', () => {
  let repository: PrismaJournalRepository;
  let outboxRepositoryMock: jest.Mocked<IOutboxRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    outboxRepositoryMock = {
      save: jest.fn(),
      fetchPending: jest.fn(),
      markProcessed: jest.fn(),
      markFailed: jest.fn(),
      fetchDeadLettered: jest.fn(),
      retryEvent: jest.fn(),
      fetchStats: jest.fn(),
    };
    repository = new PrismaJournalRepository(outboxRepositoryMock);
  });

  describe('save', () => {
    it('should save a journal entry without lines and not save to outbox if outbox is not provided', async () => {
      const repoNoOutbox = new PrismaJournalRepository();

      const txMock = {
        journalEntryModel: {
          upsert: jest.fn(),
        },
        journalLineModel: {
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(txMock);
      });

      const entry = new JournalEntry(
        'entry-id',
        'tenant-1',
        new Date('2023-01-01'),
        'Test Entry',
        'ref-1',
        AccountingMethod.Accrual
      );

      await repoNoOutbox.save(entry);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(txMock.journalEntryModel.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'entry-id' },
      }));
      expect(txMock.journalLineModel.deleteMany).toHaveBeenCalledWith({
        where: { journalEntryId: 'entry-id' },
      });
      expect(txMock.journalLineModel.createMany).not.toHaveBeenCalled();
    });

    it('should save a journal entry with lines and save to outbox', async () => {
      const txMock = {
        journalEntryModel: {
          upsert: jest.fn(),
        },
        journalLineModel: {
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(txMock);
      });

      const entry = new JournalEntry(
        'entry-id',
        'tenant-1',
        new Date('2023-01-01'),
        'Test Entry',
        'ref-1',
        AccountingMethod.Accrual
      );

      const accountCode1 = new AccountCode('1000', 'Cash', AccountCategory.Asset);

      entry.addLine(accountCode1, 1000, DebitCredit.Debit, 'Test Memo');

      await repository.save(entry);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(txMock.journalEntryModel.upsert).toHaveBeenCalled();
      expect(txMock.journalLineModel.deleteMany).toHaveBeenCalled();

      expect(txMock.journalLineModel.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            accountCode: '1000',
            amountCents: 1000,
            debitOrCredit: DebitCredit.Debit,
            memo: 'Test Memo',
          })
        ]),
      });

      expect(outboxRepositoryMock.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all journal entries when no tenantId is provided', async () => {
      const mockRecords = [
        {
          id: 'entry-1',
          tenantId: 'tenant-1',
          entryDate: new Date('2023-01-01'),
          description: 'Test 1',
          referenceId: 'ref-1',
          accountingMethod: 'accrual',
          lines: [
            {
              id: 'line-1',
              accountCode: '1000',
              accountName: 'Cash',
              accountCategory: 'asset',
              amountCents: 1000,
              debitOrCredit: 'debit',
              memo: 'Memo 1'
            }
          ]
        }
      ];

      (prisma.journalEntryModel.findMany as jest.Mock).mockResolvedValue(mockRecords);

      const result = await repository.findAll();

      expect(prisma.journalEntryModel.findMany).toHaveBeenCalledWith({
        where: undefined,
        include: { lines: true },
        orderBy: { entryDate: 'asc' }
      });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('entry-1');
      expect(result[0].lines.length).toBe(1);
      expect(result[0].lines[0].account.code).toBe('1000');
    });

    it('should return journal entries filtered by tenantId', async () => {
      const mockRecords = [
        {
          id: 'entry-2',
          tenantId: 'tenant-2',
          entryDate: new Date('2023-01-02'),
          description: 'Test 2',
          referenceId: 'ref-2',
          accountingMethod: 'cash',
          lines: []
        }
      ];

      (prisma.journalEntryModel.findMany as jest.Mock).mockResolvedValue(mockRecords);

      const result = await repository.findAll('tenant-2');

      expect(prisma.journalEntryModel.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-2' },
        include: { lines: true },
        orderBy: { entryDate: 'asc' }
      });
      expect(result.length).toBe(1);
      expect(result[0].tenantId).toBe('tenant-2');
    });
  });
});
