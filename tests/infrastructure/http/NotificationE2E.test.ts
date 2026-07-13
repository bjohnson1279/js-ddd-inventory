process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "dummy_test_secret";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";

import request from "supertest";
import { app, setupApp } from "../../../src/index";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { prisma } from "../../../src/infrastructure/database/prisma";
import jwt from "jsonwebtoken";
import http from "http";
import WebSocket from "ws";
import { WebSocketManager } from "../../../src/infrastructure/websocket/WebSocketManager";

const JWT_SECRET = process.env.JWT_SECRET || "dummy_test_secret";

describe("Notification & WebSocket E2E Suite", () => {
  beforeEach(async () => {
    const repository = new InMemoryInventoryRepository();
    setupApp(repository);
    await prisma.notificationModel.deleteMany();
    await prisma.barcodeAssignmentModel.deleteMany();
  });

  describe("REST Notifications", () => {
    it("should create, list, and read notifications", async () => {
      // 1. Create a notification
      const createRes = await request(app)
        .post("/api/notifications")
        .send({
          title: "Low Stock Alert",
          message: "SKU-ABC is running low.",
          type: "warning"
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.title).toBe("Low Stock Alert");
      expect(createRes.body.isRead).toBe(false);
      const notificationId = createRes.body.id;

      // 2. List notifications
      const listRes = await request(app).get("/api/notifications");
      expect(listRes.status).toBe(200);
      expect(listRes.body.length).toBe(1);
      expect(listRes.body[0].id).toBe(notificationId);

      // 3. Mark notification as read
      const readRes = await request(app).post(`/api/notifications/${notificationId}/read`);
      expect(readRes.status).toBe(200);
      expect(readRes.body.isRead).toBe(true);

      // 4. Verify list returns read status
      const listRes2 = await request(app).get("/api/notifications");
      expect(listRes2.body[0].isRead).toBe(true);
    });

    it("should mark all notifications as read", async () => {
      await request(app).post("/api/notifications").send({ title: "N1", message: "M1" });
      await request(app).post("/api/notifications").send({ title: "N2", message: "M2" });

      const listRes = await request(app).get("/api/notifications");
      expect(listRes.body.filter((n: any) => !n.isRead).length).toBe(2);

      const readAllRes = await request(app).post("/api/notifications/read-all");
      expect(readAllRes.status).toBe(200);

      const listRes2 = await request(app).get("/api/notifications");
      expect(listRes2.body.filter((n: any) => !n.isRead).length).toBe(0);
    });
  });

  describe("SSE Notifications", () => {
    it("should connect to SSE subscription", async () => {
      const res = await request(app)
        .get("/api/notifications/subscribe")
        .set("Accept", "text/event-stream")
        .buffer(true)
        .parse((res, cb) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
            if (data.includes("connected")) {
              (res as any).destroy();
              cb(null, data);
            }
          });
        });
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/event-stream");
    });
  });

  describe("WebSocket Scanning Broadcast", () => {
    it("should broadcast barcode scan to WebSocket clients for the same tenant", (done) => {
      const server = http.createServer(app);
      WebSocketManager.init(server);

      server.listen(0, async () => {
        const address = server.address() as any;
        const port = address.port;

        // Connect client A for tenant-1
        const clientA = new WebSocket(`ws://localhost:${port}?tenantId=tenant-1`);

        // Connect client B for tenant-2
        const clientB = new WebSocket(`ws://localhost:${port}?tenantId=tenant-2`);

        let isDoneCalled = false;
        let clientAReceived = false;
        let clientBReceived = false;

        clientA.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.rawScan === "012345678905") {
            clientAReceived = true;
            checkDone();
          }
        });

        clientB.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.rawScan === "012345678905") {
            clientBReceived = true;
          }
        });

        await new Promise<void>((resolve) => {
          let opened = 0;
          const onOpen = () => {
            opened++;
            if (opened === 2) resolve();
          };
          clientA.on("open", onOpen);
          clientB.on("open", onOpen);
        });

        // Assign barcode
        await request(app)
          .post("/api/barcodes/assign")
          .send({
            variantId: "VAR-TEST",
            symbology: "upc_a",
            barcodeValue: "012345678905",
            source: "internal",
            isPrimary: true
          });

        // Scan barcode for tenant-1 (default in tests)
        await request(app)
          .post("/api/barcodes/scan")
          .send({
            rawScan: "012345678905",
            context: "pos"
          });

        setTimeout(() => {
          checkDone();
        }, 600);

        function checkDone() {
          if (isDoneCalled) return;
          if (clientAReceived) {
            isDoneCalled = true;
            expect(clientAReceived).toBe(true);
            expect(clientBReceived).toBe(false);
            clientA.close();
            clientB.close();
            server.close(done);
          }
        }
      });
    });
  });
});
