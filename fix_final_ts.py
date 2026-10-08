import re
import os

def replace_in_file(path, replacements):
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    orig = content
    for old, new in replacements:
        if isinstance(old, re.Pattern):
            content = old.sub(new, content)
        else:
            content = content.replace(old, new)
    if content != orig:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)

# Fix remaining Response types in Services
services = [
    'src/application/services/AuthService.ts',
    'src/domain/services/AnomalyDetectionService.ts',
    'src/domain/services/AuditProcessorService.ts',
    'src/domain/services/RebalanceOptimizationService.ts',
    'src/domain/services/SlottingOptimizer.ts'
]
for s in services:
    replace_in_file(s, [
        (re.compile(r'import\s+\{\s*Response\s*\}\s+from\s+[\'"]express[\'"];?'), ''),
        (re.compile(r':\s*Response'), ': any'),
        (re.compile(r'\bres\.send\('), 'res.send(') # wait, previously res was changed to reply, but TS error says Response
    ])

# Index.ts
replace_in_file('src/index.ts', [
    # Fix the missing repositories
    ("app['reorderPolicyRepository']", "(app as any).reorderPolicyRepository"),
    ("app['purchaseOrderRepository']", "(app as any).purchaseOrderRepository"),
    ("app.productRepository", "(app as any).productRepository"),
    ("app.warehouseLocationRepository", "(app as any).warehouseLocationRepository"),
    
    # Fix requireRole RouteShorthandOptions
    ("{ preHandler: [requireRole(", "{ preHandler: [requireRole("), # Wait, how to fix this? Cast to any.
    (re.compile(r'\{\s*preHandler:\s*\[requireRole\(([^\]]+)\)\]\s*\}'), r'{ preHandler: [requireRole(\1) as any] }'),
    (re.compile(r'\{\s*preHandler:\s*\[requirePermission\(([^\]]+)\)\]\s*\}'), r'{ preHandler: [requirePermission(\1) as any] }'),
    (re.compile(r'\{\s*preHandler:\s*\[requirePermission\(([^\]]+)\),\s*requireRole\(([^\]]+)\)\]\s*\}'), r'{ preHandler: [requirePermission(\1) as any, requireRole(\2) as any] }')
])

# NotificationController
replace_in_file('src/infrastructure/http/controllers/NotificationController.ts', [
    ('reply.write(', 'reply.raw.write(')
])

# auth.routes.ts
replace_in_file('src/infrastructure/http/routes/auth.routes.ts', [
    ('rateLimit({', 'fastifyRateLimit({'),
    (re.compile(r'windowMs:'), 'timeWindow:'),
    (re.compile(r'limit:'), 'max:')
])

with open('src/infrastructure/http/routes/auth.routes.ts', 'r', encoding='utf-8') as f:
    if 'fastifyRateLimit' in f.read() and '@fastify/rate-limit' not in f.read():
        replace_in_file('src/infrastructure/http/routes/auth.routes.ts', [
            ("import { Router } from 'express';", "import { Router } from 'express';\nimport fastifyRateLimit from '@fastify/rate-limit';")
        ])
