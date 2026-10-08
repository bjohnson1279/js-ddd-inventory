const fs = require('fs');

// Fix index.ts
let c = fs.readFileSync('src/index.ts', 'utf8');
c = c.replace(/import express from "express";/g, 'import fastify from "fastify";');
c = c.replace(/import cors from "cors";/g, 'import fastifyCors from "@fastify/cors";');
c = c.replace(/import helmet from "helmet";/g, 'import fastifyHelmet from "@fastify/helmet";');
c = c.replace(/import { rateLimit } from "express-rate-limit";/g, 'import fastifyRateLimit from "@fastify/rate-limit";');
c = c.replace(/const app = express\(\);/g, 'const app = fastify();');
c = c.replace(/app\.use\(cors\(\)\);/g, 'app.register(fastifyCors);');
c = c.replace(/app\.use\(helmet\(\)\);/g, 'app.register(fastifyHelmet);');
c = c.replace(/\(req, res\)/g, '(request: any, reply: any)');
c = c.replace(/\(req: Request, res: Response\)/g, '(request: any, reply: any)');
c = c.replace(/\(req: any, reply: any, next: any\)/g, '(request: any, reply: any, next: any)');
c = c.replace(/const app: FastifyInstance/g, 'const app = fastify(); //');
c = c.replace(/FastifyInstance/g, 'any');
c = c.replace(/req: /g, "request: ");
c = c.replace(/res: /g, "reply: ");
c = c.replace(/req, reply/g, "request: any, reply: any");
c = c.replace(/\(req, reply\)/g, "(request: any, reply: any)");

// Fastify routes
c = c.replace(/app\.use\("\/api\/inventory", inventoryRoutes\);/g, 'app.register(inventoryRoutes, { prefix: "/api/inventory" });');
c = c.replace(/app\.use\("\/api\/shopify", shopifyRoutes\);/g, 'app.register(shopifyRoutes, { prefix: "/api/shopify" });');
c = c.replace(/app\.use\("\/api\/onboarding", onboardingRoutes\);/g, 'app.register(onboardingRoutes, { prefix: "/api/onboarding" });');
c = c.replace(/app\.use\((.*?)Routes\);/g, 'app.register($1Routes);');

fs.writeFileSync('src/index.ts', c);

// Fix rma.ts
let r = fs.readFileSync('src/infrastructure/graphql/resolvers/rma.ts', 'utf8');
r = r.replace(/\(rmaRepo, rmaNumber, warehouseId\)/g, '(rmaRepo: any, rmaNumber: any, warehouseId: any)');
r = r.replace(/\(rmaRepo, rmaId, itemId, disposition\)/g, '(rmaRepo: any, rmaId: any, itemId: any, disposition: any)');
r = r.replace(/\(rmaRepo, rmaNumber, itemId, notes\)/g, '(rmaRepo: any, rmaNumber: any, itemId: any, notes: any)');
fs.writeFileSync('src/infrastructure/graphql/resolvers/rma.ts', r);

// Fix remaining controllers 
const glob = require('glob');
const controllers = glob.sync('src/infrastructure/http/controllers/**/*.ts');
controllers.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/\(req: FastifyRequest, /g, "(request: any, ");
    content = content.replace(/\(req: any, /g, "(request: any, ");
    content = content.replace(/res\.send/g, "reply.send");
    content = content.replace(/res\.status/g, "reply.status");
    content = content.replace(/req\./g, "request.");
    content = content.replace(/res\./g, "reply.");
    content = content.replace(/request\.app\.get/g, "(request.server as any).");
    fs.writeFileSync(f, content);
});

const services = glob.sync('src/domain/services/**/*.ts');
services.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/res\.send/g, "reply.send");
    content = content.replace(/res\./g, "reply.");
    fs.writeFileSync(f, content);
});
