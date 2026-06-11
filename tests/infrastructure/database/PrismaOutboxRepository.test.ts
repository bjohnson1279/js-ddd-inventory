import { PrismaOutboxRepository } from "../../../src/infrastructure/database/PrismaOutboxRepository";
import { prisma as sharedPrisma } from "../../../src/infrastructure/database/prisma";
import { IDomainEvent } from "../../../src/domain/events/IDomainEvent";

describe("PrismaOutboxRepository Integration Tests", () => {
  let prisma = sharedPrisma;
  let outboxRepo: PrismaOutboxRepository;

  beforeAll(() => {
    outboxRepo = new PrismaOutboxRepository();
  });

  beforeEach(async () => {
    await prisma.outboxEventModel.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
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
    // Default nextAttemptAt should be very close to the event occurrence
    expect(new Date(pending[0].nextAttemptAt).getTime()).toBeLessThanOrEqual(Date.now() + 5000);
  });

  it("should calculate exponential backoff on failure and filter appropriately", async () => {
    const event: IDomainEvent = {
      occurredOn: new Date(),
      eventName: "FailEvent",
    };

    await outboxRepo.save(event);
    
    // Fetch it
    let pending = await outboxRepo.fetchPending(10);
    expect(pending.length).toBe(1);
    const eventId = pending[0].id;

    // Mark it as failed once (1st attempt -> backoff = 2 seconds)
    await outboxRepo.markFailed(eventId, "First Error");

    // Fetch again immediately - should be skipped because nextAttemptAt is in the future
    pending = await outboxRepo.fetchPending(10);
    expect(pending.length).toBe(0);

    // Fetch the raw model to verify attempts and nextAttemptAt
    let raw = await prisma.outboxEventModel.findUnique({ where: { id: eventId } });
    expect(raw?.attempts).toBe(1);
    expect(raw?.lastError).toBe("First Error");
    expect(new Date(raw!.nextAttemptAt).getTime()).toBeGreaterThan(Date.now() + 1500);

    // Manually wind nextAttemptAt to the past
    await prisma.outboxEventModel.update({
      where: { id: eventId },
      data: {
        nextAttemptAt: new Date(Date.now() - 1000)
      }
    });

    // Should be fetched again now that nextAttemptAt is in the past
    pending = await outboxRepo.fetchPending(10);
    expect(pending.length).toBe(1);

    // Mark it as failed a second time (2nd attempt -> backoff = 4 seconds)
    await outboxRepo.markFailed(eventId, "Second Error");

    // Check raw model for updated parameters
    raw = await prisma.outboxEventModel.findUnique({ where: { id: eventId } });
    expect(raw?.attempts).toBe(2);
    expect(raw?.lastError).toBe("Second Error");
    expect(new Date(raw!.nextAttemptAt).getTime()).toBeGreaterThan(Date.now() + 3500);
  });
});
