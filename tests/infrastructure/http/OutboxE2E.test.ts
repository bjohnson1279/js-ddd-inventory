process.env.COMPLIANCE_PRIVATE_KEY = "test_key";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "dummy_test_secret";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app, setupApp } from "../../../src/index";
import { InMemoryOutboxRepository } from "../../../src/infrastructure/database/InMemoryOutboxRepository";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";


const getAdminToken = () => {
  const JWT_SECRET = process.env.JWT_SECRET || "dummy_test_secret";
  return jwt.sign({ actorId: "admin-user", role: "admin", tenantId: "tenant-1" }, JWT_SECRET);
};

describe("Dead Letter Queue (DLQ) HTTP API Endpoints", () => {
  let outboxRepo: InMemoryOutboxRepository;
  let inventoryRepo: InMemoryInventoryRepository;

  beforeEach(() => {
    outboxRepo = new InMemoryOutboxRepository();
    inventoryRepo = new InMemoryInventoryRepository(outboxRepo);

    // Register with express app
    setupApp(inventoryRepo, undefined, undefined, undefined, undefined, undefined, undefined, outboxRepo);
  });

  it("should list dead-lettered events and trigger manual retry via API", async () => {
    // 1. Create and save some outbox events
    const event1 = {
      occurredOn: new Date(),
      eventName: "TestEvent1",
    };
    const event2 = {
      occurredOn: new Date(),
      eventName: "TestEvent2",
    };

    await outboxRepo.save(event1);
    await outboxRepo.save(event2);

    const pending = await outboxRepo.fetchPending(10);
    expect(pending.length).toBe(2);

    const eventId1 = pending[0].id;
    const eventId2 = pending[1].id;

    // 2. Mark event1 as failed 5 times (exceeds threshold of 5 attempts)
    for (let i = 0; i < 5; i++) {
      await outboxRepo.markFailed(eventId1, `Error ${i}`);
    }

    // 3. Mark event2 as failed 2 times (does not exceed threshold)
    await outboxRepo.markFailed(eventId2, "Error A");
    await outboxRepo.markFailed(eventId2, "Error B");

    // Wind event2's nextAttemptAt to the past so it's eligible for polling
    const e2 = outboxRepo.entries.find(e => e.id === eventId2);
    if (e2) {
      e2.nextAttemptAt = new Date(Date.now() - 1000);
    }

    // 4. Query GET /api/outbox/dead-letter
    const dlqResponse = await request(app)
      .get("/api/outbox/dead-letter")
        .set("Authorization", `Bearer ${getAdminToken()}`)
      .expect(200);

    expect(dlqResponse.body.length).toBe(1);
    expect(dlqResponse.body[0].id).toBe(eventId1);
    expect(dlqResponse.body[0].attempts).toBe(5);
    expect(dlqResponse.body[0].lastError).toBe("Error 4");

    // 5. Query fetchPending - should only return event2 (event1 is dead-lettered)
    const activePending = await outboxRepo.fetchPending(10);
    expect(activePending.length).toBe(1);
    expect(activePending[0].id).toBe(eventId2);

    // 6. Retry event1 via POST /api/outbox/:id/retry
    await request(app)
      .post(`/api/outbox/${eventId1}/retry`).set("Authorization", `Bearer ${getAdminToken()}`)
      .expect(200);

    // 7. Verify event1 is no longer in the DLQ list and is active pending again
    const dlqResponseAfter = await request(app)
      .get("/api/outbox/dead-letter")
        .set("Authorization", `Bearer ${getAdminToken()}`)
      .expect(200);
    expect(dlqResponseAfter.body.length).toBe(0);

    const finalPending = await outboxRepo.fetchPending(10);
    expect(finalPending.length).toBe(2);
    const retriedEvent = finalPending.find(e => e.id === eventId1);
    expect(retriedEvent?.attempts).toBe(0);
    expect(retriedEvent?.lastError).toBeNull();
  });

  it("should fetch outbox diagnostics and stats via API", async () => {
    // 1. Setup events
    await outboxRepo.save({ occurredOn: new Date(), eventName: "Event1" });
    await outboxRepo.save({ occurredOn: new Date(), eventName: "Event2" });
    await outboxRepo.save({ occurredOn: new Date(), eventName: "Event3" });

    // Fetch pending to get real IDs
    const pending = await outboxRepo.fetchPending(10);
    
    // Fail one event 6 times (dead lettered)
    for (let i = 0; i < 6; i++) {
      await outboxRepo.markFailed(pending[0].id, `Fail ${i}`);
    }

    // Fail another event 2 times (recent failure)
    await outboxRepo.markFailed(pending[1].id, "Temp Fail A");
    await outboxRepo.markFailed(pending[1].id, "Temp Fail B");

    // Process event 3 successfully (in-memory mock processed)
    await outboxRepo.markProcessed(pending[2].id);

    // 2. Query stats endpoint
    const statsResponse = await request(app)
      .get("/api/outbox/stats")
        .set("Authorization", `Bearer ${getAdminToken()}`)
      .expect(200);

    expect(statsResponse.body.totalPending).toBe(1); // Only Event2 is pending (Event1 is DLQ, Event3 is processed)
    expect(statsResponse.body.totalProcessed).toBe(1); // Event3 is processed
    expect(statsResponse.body.totalDeadLettered).toBe(1); // Event1 is dead lettered
    expect(statsResponse.body.recentFailures.length).toBe(1); // Event2 is the recent failure (attempts > 0 and lt 5)
    expect(statsResponse.body.recentFailures[0].id).toBe(pending[1].id);
    expect(statsResponse.body.recentFailures[0].attempts).toBe(2);
    expect(statsResponse.body.recentFailures[0].lastError).toBe("Temp Fail B");
  });
});
