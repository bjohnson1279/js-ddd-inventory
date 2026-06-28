import { WebSocketManager } from "../../../src/infrastructure/websocket/WebSocketManager";
import { WebSocket, WebSocketServer } from "ws";

jest.mock("ws", () => {
  const mockWS = {
    on: jest.fn(),
    send: jest.fn(),
    readyState: 1 // WebSocket.OPEN
  };

  const mockWSS = {
    on: jest.fn((event, handler) => {
      if (event === "connection") {
        mockWSS.connectionHandler = handler;
      }
    }),
    connectionHandler: null as any
  };

  return {
    WebSocket: {
      OPEN: 1,
      CLOSED: 3
    },
    WebSocketServer: jest.fn(() => mockWSS)
  };
});

describe("WebSocketManager", () => {
  let mockServer: any;

  beforeEach(() => {
    mockServer = {};
    jest.clearAllMocks();
  });

  it("should initialize WebSocketServer and listen for connections", () => {
    const wss = WebSocketManager.init(mockServer);
    expect(WebSocketServer).toHaveBeenCalledWith({ server: mockServer });
    expect(wss.on).toHaveBeenCalledWith("connection", expect.any(Function));
  });

  it("should handle client connection and support subscription messages", () => {
    const wss = WebSocketManager.init(mockServer);
    const mockWS = {
      on: jest.fn((event, cb) => {
        if (event === "message") {
          mockWS.messageHandler = cb;
        } else if (event === "close") {
          mockWS.closeHandler = cb;
        } else if (event === "error") {
          mockWS.errorHandler = cb;
        }
      }),
      send: jest.fn(),
      readyState: 1, // OPEN
      messageHandler: null as any,
      closeHandler: null as any,
      errorHandler: null as any
    };

    const mockReq = {
      url: "/?tenantId=tenant-123",
      headers: { host: "localhost" }
    };

    // Simulate connection
    (wss as any).connectionHandler(mockWS, mockReq);
    expect(mockWS.on).toHaveBeenCalledWith("message", expect.any(Function));
    expect(mockWS.on).toHaveBeenCalledWith("close", expect.any(Function));

    // Broadcast to tenant-123 should send message
    WebSocketManager.broadcastToTenant("tenant-123", { data: "hello" });
    expect(mockWS.send).toHaveBeenCalledWith(JSON.stringify({ data: "hello" }));

    // Simulate client sending message to subscribe to new tenant-456
    mockWS.messageHandler(JSON.stringify({ type: "subscribe", tenantId: "tenant-456" }));
    expect(mockWS.send).toHaveBeenCalledWith(JSON.stringify({ type: "subscribed", tenantId: "tenant-456" }));

    // Broadcast to tenant-123 should no longer send message to mockWS
    jest.clearAllMocks();
    WebSocketManager.broadcastToTenant("tenant-123", { data: "hello-again" });
    expect(mockWS.send).not.toHaveBeenCalled();

    // Broadcast to tenant-456 should send message to mockWS
    WebSocketManager.broadcastToTenant("tenant-456", { data: "hello-new-tenant" });
    expect(mockWS.send).toHaveBeenCalledWith(JSON.stringify({ data: "hello-new-tenant" }));

    // Simulate error handle
    mockWS.errorHandler();

    // Simulate disconnect close
    mockWS.closeHandler();
    jest.clearAllMocks();
    WebSocketManager.broadcastToTenant("tenant-456", { data: "no-one-listens" });
    expect(mockWS.send).not.toHaveBeenCalled();
  });
});
