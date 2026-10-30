const store: any[] = [];

jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    outboxEventModel: {
      deleteMany: jest.fn(async () => {
        store.length = 0;
      }),
      create: jest.fn(async (args: any) => {
        const item = {
          id: randomUUID(),
          attempts: 0,
          processedAt: null,
          lastError: null,
          nextAttemptAt: new Date(),
          ...args.data,
        };
        store.push(item);
        return item;
      }),
      findMany: jest.fn(async (args?: any) => {
        let results = [...store];
        const where = args?.where;
        if (where) {
          if (where.processedAt === null) {
            results = results.filter(r => r.processedAt === null);
          }
          if (where.attempts) {
            if (where.attempts.lt !== undefined) {
              results = results.filter(r => r.attempts < where.attempts.lt);
            }
            if (where.attempts.gte !== undefined) {
              results = results.filter(r => r.attempts >= where.attempts.gte);
            }
          }
          if (where.nextAttemptAt?.lte) {
            const target = new Date(where.nextAttemptAt.lte).getTime();
            results = results.filter(r => new Date(r.nextAttemptAt).getTime() <= target);
          }
        }
        if (args?.take) {
          results = results.slice(0, args.take);
        }
        return results;
      }),
      findUnique: jest.fn(async (args: any) => {
        return store.find(r => r.id === args.where.id) || null;
      }),
      update: jest.fn(async (args: any) => {
        const item = store.find(r => r.id === args.where.id);
        if (item) {
          Object.assign(item, args.data);
        }
        return item;
      }),
      updateMany: jest.fn(async (args: any) => {
        const ids = args?.where?.id?.in || [];
        for (const item of store) {
          if (ids.includes(item.id)) {
            Object.assign(item, args.data);
          }
        }
      }),
    },
    $disconnect: jest.fn(),
  },
}));

import { PrismaOutboxRepository } from "../../../src/infrastructure/database/PrismaOutboxRepository";
import { IDomainEvent } from "../../../src/domain/events/IDomainEvent";
import { randomUUID } from "crypto";

describe("PrismaOutboxRepository Unit Tests", () => {
  let outboxRepo: PrismaOutboxRepository;

  beforeAll(() => {
    outboxRepo = new PrismaOutboxRepository();
  });

  beforeEach(() => {
    store.length = 0;
    jest.clearAllMocks();
  });

  it("should save an event and fetch it as pending", async () => {
    const event: IDomainEvent = {
      occurredOn: new Date(),
      eventName: "TestEvent",
    };

    await outboxRepo.save(event);

    const pending = await outboxRepo.fetchPending(10);
    expect(pending.length).toBe(1);
    expect(pending[0].eventName).toBe("TestEvent");
    expect(pending[0].attempts).toBe(0);
    expect(pending[0].processedAt).toBeNull();
    expect(pending[0].nextAttemptAt).not.toBeNull();
    expect(new Date(pending[0].nextAttemptAt).getTime()).toBeLessThanOrEqual(Date.now() + 5000);
  });

  it("should calculate exponential backoff on failure and filter appropriately", async () => {
    const event: IDomainEvent = {
      occurredOn: new Date(),
      eventName: "FailEvent",
    };

    await outboxRepo.save(event);
    
    let pending = await outboxRepo.fetchPending(10);
    expect(pending.length).toBe(1);
    const eventId = pending[0].id;

    await outboxRepo.markFailed(eventId, "First Error");

    pending = await outboxRepo.fetchPending(10);
    expect(pending.length).toBe(0);

    const raw = store.find(r => r.id === eventId);
    expect(raw?.attempts).toBe(1);
    expect(raw?.lastError).toBe("First Error");
    expect(new Date(raw!.nextAttemptAt).getTime()).toBeGreaterThan(Date.now() + 1000);

    raw!.nextAttemptAt = new Date(Date.now() - 1000);

    pending = await outboxRepo.fetchPending(10);
    expect(pending.length).toBe(1);

    await outboxRepo.markFailed(eventId, "Second Error");

    expect(raw?.attempts).toBe(2);
    expect(raw?.lastError).toBe("Second Error");
    expect(new Date(raw!.nextAttemptAt).getTime()).toBeGreaterThan(Date.now() + 2500);
  });
});
