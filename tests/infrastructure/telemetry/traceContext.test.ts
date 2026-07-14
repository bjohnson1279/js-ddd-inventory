import { runWithTrace, getTraceId, generateTraceId } from "../../../src/infrastructure/telemetry/traceContext";

describe("traceContext", () => {
  it("should generate a traceId", () => {
    const traceId = generateTraceId();
    expect(traceId).toBeDefined();
    expect(typeof traceId).toBe("string");
    expect(traceId.length).toBeGreaterThan(0);
  });

  it("should bind and retrieve traceId using AsyncLocalStorage", () => {
    const traceId = "test-trace-id-123";
    expect(getTraceId()).toBe("");

    runWithTrace(traceId, () => {
      expect(getTraceId()).toBe(traceId);
    });

    expect(getTraceId()).toBe("");
  });

  it("should isolate contexts concurrently", async () => {
    const runAsync = (id: string, delay: number) => {
      return runWithTrace(id, async () => {
        expect(getTraceId()).toBe(id);
        await new Promise((resolve) => setTimeout(resolve, delay));
        expect(getTraceId()).toBe(id);
        return getTraceId();
      });
    };

    const results = await Promise.all([
      runAsync("trace-A", 20),
      runAsync("trace-B", 10),
    ]);

    expect(results).toEqual(["trace-A", "trace-B"]);
  });
});
