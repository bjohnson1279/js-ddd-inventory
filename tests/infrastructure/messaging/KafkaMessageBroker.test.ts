import { KafkaMessageBroker } from "../../../src/infrastructure/messaging/KafkaMessageBroker";
import { Kafka } from "kafkajs";

jest.mock("kafkajs", () => {
  const mockProducer = {
    connect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };

  const mockKafka = jest.fn().mockImplementation(() => ({
    producer: jest.fn().mockReturnValue(mockProducer),
  }));

  return {
    Kafka: mockKafka,
  };
});

describe("KafkaMessageBroker", () => {
  let broker: KafkaMessageBroker;
  let mockProducerInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    broker = new KafkaMessageBroker("localhost:9092,localhost:9093");
    // Retrieve mock producer instance
    const kafkaInstance = new Kafka({ clientId: 't', brokers: [] });
    mockProducerInstance = kafkaInstance.producer();
  });

  it("should initialize Kafka instance with correct brokers array", () => {
    expect(Kafka).toHaveBeenCalledWith(
      expect.objectContaining({
        brokers: ["localhost:9092", "localhost:9093"],
        clientId: "js-ddd-inventory",
      })
    );
  });

  it("should connect producer and publish messages correctly", async () => {
    const mockEvent = {
      occurredOn: new Date("2026-07-15T00:00:00Z"),
      tenantId: "tenant-123",
      payload: { value: 123 },
    } as any;

    await broker.publish("test-topic", mockEvent);

    expect(mockProducerInstance.connect).toHaveBeenCalledTimes(1);
    expect(mockProducerInstance.send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "test-topic",
        messages: [
          expect.objectContaining({
            key: "tenant-123",
            value: expect.any(String),
          }),
        ],
      })
    );

    const sentMessageValue = JSON.parse(mockProducerInstance.send.mock.calls[0][0].messages[0].value);
    expect(sentMessageValue.tenantId).toBe("tenant-123");
    expect(sentMessageValue.occurredOn).toBe("2026-07-15T00:00:00.000Z");
  });

  it("should disconnect producer successfully", async () => {
    const mockEvent = { occurredOn: new Date() } as any;
    await broker.publish("test-topic", mockEvent);
    await broker.disconnect();

    expect(mockProducerInstance.disconnect).toHaveBeenCalledTimes(1);
  });

  it("should handle connection errors", async () => {
    mockProducerInstance.connect.mockRejectedValueOnce(new Error("Kafka connection failure"));

    const mockEvent = { occurredOn: new Date() } as any;
    await expect(broker.publish("test-topic", mockEvent)).rejects.toThrow("Kafka connection failure");
  });

  it("should handle publishing errors", async () => {
    mockProducerInstance.send.mockRejectedValueOnce(new Error("Kafka publish failure"));

    const mockEvent = { occurredOn: new Date() } as any;
    await expect(broker.publish("test-topic", mockEvent)).rejects.toThrow("Kafka publish failure");
  });
});
