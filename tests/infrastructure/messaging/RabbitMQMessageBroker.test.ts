import { RabbitMQMessageBroker } from "../../../src/infrastructure/messaging/RabbitMQMessageBroker";
import amqp from "amqplib";

jest.mock("amqplib");

describe("RabbitMQMessageBroker", () => {
  let mockConnection: any;
  let mockChannel: any;
  let broker: RabbitMQMessageBroker;

  beforeEach(() => {
    jest.clearAllMocks();

    mockChannel = {
      assertExchange: jest.fn().mockResolvedValue({}),
      publish: jest.fn(),
      close: jest.fn().mockResolvedValue({}),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue({}),
    };

    (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);

    broker = new RabbitMQMessageBroker("amqp://localhost");
  });

  it("should connect and publish events successfully", async () => {
    const mockEvent = {
      occurredOn: new Date("2026-06-09T12:00:00Z"),
      eventName: "TestEvent",
      payloadData: "hello"
    };

    await broker.publish("test-topic", mockEvent);

    // Verify amqp.connect was called with the correct URL
    expect(amqp.connect).toHaveBeenCalledWith("amqp://localhost");

    // Verify channel assertExchange and publish were called
    expect(mockChannel.assertExchange).toHaveBeenCalledWith("domain_events", "topic", { durable: true });
    expect(mockChannel.publish).toHaveBeenCalledWith(
      "domain_events",
      "test-topic",
      expect.any(Buffer),
      { persistent: true }
    );

    // Verify published message structure
    const publishedBuffer = mockChannel.publish.mock.calls[0][2];
    const parsedPayload = JSON.parse(publishedBuffer.toString());
    expect(parsedPayload.eventName).toBe("TestEvent");
    expect(parsedPayload.occurredOn).toBe("2026-06-09T12:00:00.000Z");
  });

  it("should close channel and connection when disconnect is called", async () => {
    // Publish to force connection
    const mockEvent = { occurredOn: new Date(), eventName: "TestEvent" };
    await broker.publish("test-topic", mockEvent);

    await broker.disconnect();

    expect(mockChannel.close).toHaveBeenCalled();
    expect(mockConnection.close).toHaveBeenCalled();
  });
});
