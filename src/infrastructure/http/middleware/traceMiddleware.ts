import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { runWithTrace, generateTraceId } from "../../telemetry/traceContext";

export function traceMiddleware(request: FastifyRequest, reply: FastifyReply, next: () => void) {
  const headerTraceId = request.headers["x-trace-id"] || request.headers["traceparent"];
  const traceId = typeof headerTraceId === "string" ? headerTraceId : generateTraceId();

  res.setHeader("x-trace-id", traceId);

  runWithTrace(traceId, () => {
    next();
  });
}
