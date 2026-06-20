import { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";

// Store active connections: tenantId -> Set of WebSockets
const tenantClients = new Map<string, Set<WebSocket>>();

export class WebSocketManager {
  private static wss: WebSocketServer | null = null;

  static init(server: any) {
    this.wss = new WebSocketServer({ server });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      // Extract tenantId from URL query params, e.g. ws://localhost:5000?tenantId=tenant-1
      const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
      let tenantId = url.searchParams.get("tenantId") || "tenant-1";

      if (!tenantClients.has(tenantId)) {
        tenantClients.set(tenantId, new Set());
      }
      tenantClients.get(tenantId)!.add(ws);

      ws.on("message", (message: string) => {
        try {
          const parsed = JSON.parse(message);
          // Allow client to subscribe/change tenant via message as well
          if (parsed.type === "subscribe" && parsed.tenantId) {
            // Remove from old tenant set
            tenantClients.get(tenantId)?.delete(ws);
            tenantId = parsed.tenantId;
            if (!tenantClients.has(tenantId)) {
              tenantClients.set(tenantId, new Set());
            }
            tenantClients.get(tenantId)!.add(ws);
            ws.send(JSON.stringify({ type: "subscribed", tenantId }));
          }
        } catch (e) {
          // Ignore non-JSON messages
        }
      });

      ws.on("close", () => {
        tenantClients.get(tenantId)?.delete(ws);
      });

      ws.on("error", () => {
        tenantClients.get(tenantId)?.delete(ws);
      });
    });

    console.log("WebSocket Server initialized and attached to HTTP server.");
    return this.wss;
  }

  static broadcastToTenant(tenantId: string, payload: any) {
    const clients = tenantClients.get(tenantId);
    if (clients) {
      const message = JSON.stringify(payload);
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    }
  }
}
