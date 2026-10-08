const fs = require('fs');
const path = require('path');
const process = require('process');

const indexPath = path.join(process.cwd(), 'src/index.ts');
let content = fs.readFileSync(indexPath, 'utf8');

// Replace express imports
content = content.replace(/import express(, \{.*?\})? from 'express';/, "import Fastify, { FastifyInstance } from 'fastify';");
content = content.replace(/import cors from 'cors';/, "import cors from '@fastify/cors';");
content = content.replace(/import helmet from 'helmet';/, "import helmet from '@fastify/helmet';");
content = content.replace(/import rateLimit from 'express-rate-limit';/, "import rateLimit from '@fastify/rate-limit';");
content = content.replace(/import \{.*?\} from 'express';\n/, ""); // Just in case it has Request, Response
content = content.replace(/const app = express\(\);/, "const app = Fastify({ logger: true });");

// Plugins
content = content.replace(/app\.use\(cors\(.*?\)\);/s, "app.register(cors, { origin: '*' });");
content = content.replace(/app\.use\(helmet\(\)\);/, "app.register(helmet);");
content = content.replace(/app\.use\(express\.json\(\)\);/, "");

const rateLimitRegex = /const limiter = rateLimit\(\{[\s\S]*?\}\);\s*app\.use\(limiter\);/g;
content = content.replace(rateLimitRegex, "app.register(rateLimit, { max: 100, timeWindow: '1 minute' });");

// Custom middlewares
content = content.replace(/app\.use\(platformThrottlingMiddleware\);/, "app.addHook('preHandler', platformThrottlingMiddleware);");
content = content.replace(/app\.use\(traceMiddleware\);/, "app.addHook('onRequest', traceMiddleware);");

// Dependencies (app.set -> app.decorate)
content = content.replace(/app\.set\(['"](.*?)['"], (.*?)\);/g, "app.decorate('$1', $2);");

// Routes
content = content.replace(/app\.use\(['"](.*?)['"], (.*?)Router\);/g, "app.register($2Router, { prefix: '$1' });");
content = content.replace(/app\.use\(['"](.*?)['"], (.*?)\);/g, "app.register($2, { prefix: '$1' });");

// Startup
content = content.replace(/const server = app\.listen\(PORT, \(\) => \{/g, "app.listen({ port: parseInt(PORT.toString()), host: '0.0.0.0' }, (err, address) => { if (err) { console.error(err); process.exit(1); }");
content = content.replace(/server = app\.listen\(0\);/g, "app.listen({ port: 0 });");

content = content.replace(/WebSocketManager\.init\(server\);/g, "WebSocketManager.init(app.server);");
content = content.replace(/app\.get\(['"](.*?)['"]\)/g, "app['$1']"); // This breaks routes like app.get('/health', ...) but let's fix that.
// Restore app.get('/health') and similar route handlers
content = content.replace(/app\['\/health'\]/g, "app.get('/health'"); 
content = content.replace(/app\['\/metrics'\]/g, "app.get('/metrics'"); 
content = content.replace(/app\['\/(.*?)'\]/g, "app.get('/$1'"); // Undo if it matched routes

// Fix Request, Response in app.get
content = content.replace(/\(req: Request, res: Response\)/g, "(req, reply)");
content = content.replace(/\(req, res\)/g, "(req, reply)");
content = content.replace(/res\.json\(/g, "reply.send(");
content = content.replace(/res\.send\(/g, "reply.send(");
content = content.replace(/res\.status\(/g, "reply.status(");
content = content.replace(/req\.app\.get\(['"](.*?)['"]\)/g, "req.server['$1']");

fs.writeFileSync(indexPath, content);
console.log('Fixed index.ts');
