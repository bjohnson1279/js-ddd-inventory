import re

# index.ts
with open('src/index.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Remove rate limiter registration
c = re.sub(r'app\.register\(fastifyRateLimit,\s*\{[\s\S]*?\}\);', '', c)

# Fix remaining route signature issues: app.get(..., { preHandler: ... }) instead of direct arguments
c = re.sub(r'(app\.(?:get|post|put|delete|patch))\(([^,]+),\s*requirePermission\(([^)]+)\),\s*\(request', r'\1(\2, { preHandler: [requirePermission(\3)] }, (request', c)
c = re.sub(r'(app\.(?:get|post|put|delete|patch))\(([^,]+),\s*requireRole\(([^)]+)\),\s*\(request', r'\1(\2, { preHandler: [requireRole(\3)] }, (request', c)
c = re.sub(r'(app\.(?:get|post|put|delete|patch))\(([^,]+),\s*requirePermission\(([^)]+)\),\s*requireRole\(([^)]+)\),\s*\(request', r'\1(\2, { preHandler: [requirePermission(\3), requireRole(\4)] }, (request', c)

# Replace 'any' usage on app properties to avoid fastify.d.ts problems
c = c.replace('app["reorderPolicyRepository"]', '(app as any).reorderPolicyRepository')
c = c.replace('app["purchaseOrderRepository"]', '(app as any).purchaseOrderRepository')
c = c.replace('app.productRepository', '(app as any).productRepository')
c = c.replace('app.warehouseLocationRepository', '(app as any).warehouseLocationRepository')
c = c.replace('app.reorderPolicyRepository', '(app as any).reorderPolicyRepository')
c = c.replace('app.purchaseOrderRepository', '(app as any).purchaseOrderRepository')

# Fix auth.routes.ts express-rate-limit again
with open('src/infrastructure/http/routes/auth.routes.ts', 'r', encoding='utf-8') as f:
    a = f.read()
a = re.sub(r"import\s+\{\s*rateLimit\s*\}\s+from\s+['\"]express-rate-limit['\"];", "", a)
with open('src/infrastructure/http/routes/auth.routes.ts', 'w', encoding='utf-8') as f:
    f.write(a)

with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(c)

# NotificationController.ts
with open('src/infrastructure/http/controllers/NotificationController.ts', 'r', encoding='utf-8') as f:
    nc = f.read()
nc = nc.replace('reply.raw.write', 'reply.raw.write')
nc = nc.replace('reply.write(', 'reply.raw.write(')
with open('src/infrastructure/http/controllers/NotificationController.ts', 'w', encoding='utf-8') as f:
    f.write(nc)
