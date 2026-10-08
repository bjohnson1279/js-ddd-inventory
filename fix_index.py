import re

filepath = r"c:\Users\johns\DEV\inventory\js-ddd-inventory\src\index.ts"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Replace express imports
content = re.sub(r'import express from "express";', 'import Fastify, { FastifyRequest, FastifyReply } from "fastify";\nimport fastifyExpress from "@fastify/express";', content) # Wait, can't use @fastify/express because of instruction!
content = re.sub(r'import fastifyExpress.*?\n', '', content)

content = content.replace('import cors from "cors";', 'import cors from "@fastify/cors";')
content = content.replace('import helmet from "helmet";', 'import helmet from "@fastify/helmet";')
content = content.replace('import { rateLimit } from "express-rate-limit";', 'import rateLimit from "@fastify/rate-limit";')
content = content.replace('import { IncomingMessage, ServerResponse } from "http";', '')

# req: Request -> request: FastifyRequest
content = content.replace('req: Request', 'request: FastifyRequest')
content = content.replace('res: Response', 'reply: FastifyReply')
content = content.replace('req: AuthenticatedRequest', 'request: AuthenticatedRequest')
content = content.replace('res: Response', 'reply: FastifyReply')

# app = express()
content = content.replace('const app = express();', 'const app = Fastify({ logger: false });')
content = content.replace('app.disable("x-powered-by");', '')
content = content.replace('app.set("trust proxy", 1);', '')
content = content.replace('app.use(express.json());', '')
content = content.replace('app.use("/api/shopify", express.json({', '// app.use("/api/shopify", express.json({')
content = content.replace('  verify: (req: IncomingMessage, res: ServerResponse, buf: Buffer) => {', '//')
content = content.replace('    (req as any).rawBody = buf;', '//')
content = content.replace('  }', '//')
content = content.replace('}));', '//')

# Replace app.set to decorate
content = re.sub(r'app\.set\("(.*?)", (.*?)\);', r'app.decorate("\1", \2);', content)
content = re.sub(r'app\.get\("(.*?)"\)', r'app.\1', content)

# Middlewares
content = content.replace('app.use(helmet());', 'app.register(helmet);')
content = content.replace('app.use(cors({ origin: allowedOrigins }));', 'app.register(cors, { origin: allowedOrigins });')
content = content.replace('app.use(limiter);', 'app.register(rateLimit, {\n  max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 100,\n  timeWindow: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS) : 15 * 60 * 1000\n});')

content = content.replace('app.use(traceMiddleware);', 'app.addHook("preHandler", traceMiddleware);')

# Routers
# app.use("/api/auth", authRoutes) -> app.register(authRoutes, { prefix: "/api/auth" })
content = re.sub(r'app\.use\("(.*?)", (.*?[rR]outes.*?)\);', r'app.register(\2, { prefix: "\1" });', content)
content = re.sub(r'app\.use\("(.*?)", (.*?[rR]outer.*?)\);', r'app.register(\2, { prefix: "\1" });', content)

# Manual inline routes in index.ts:
# app.get("/api/admin...", requireRole, (req, res)) -> app.get("/api/admin...", { preHandler: [requireRole] }, async (request, reply))
content = re.sub(r'app\.(get|post|put|delete)\("(.*?)", requireRole\(\[(.*?)\]\), (?:async )?\(req, res\) => {', r'app.\1("\2", { preHandler: [requireRole([\3])] }, async (req, reply) => {', content)
content = re.sub(r'app\.(get|post|put|delete)\("(.*?)", (?:async )?\(req, res\) => {', r'app.\1("\2", async (req, reply) => {', content)

content = content.replace('req.body', 'req.body as any')
content = content.replace('req.query', 'req.query as any')
content = content.replace('res.status(', 'reply.status(')
content = content.replace('res.json(', 'reply.send(')
content = content.replace('res.send(', 'reply.send(')

# Change req, res in the rest of index.ts
# We need to make sure we don't break WebSocketManager.init(server)
content = content.replace('WebSocketManager.init(server);', 'WebSocketManager.init(app.server);')

# Listen
# const server = app.listen(port, () => {
content = re.sub(r'const server = app\.listen\(port, \(\) => \{(.*?)\}\);', r'app.listen({ port: typeof port === "string" ? parseInt(port) : port, host: "0.0.0.0" }, () => {\1});', content, flags=re.DOTALL)


with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("index.ts rewritten")
