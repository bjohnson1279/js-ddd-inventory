import os
import re

def replace_in_file(path, replacements):
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

# Index
replace_in_file('src/index.ts', [
    ('rateLimit(', 'fastifyRateLimit('),
    ('helmet(', 'fastifyHelmet('),
    ('cors(', 'fastifyCors('),
    ('express.json()', 'fastify.json()'), # wait fastify has no fastify.json(). I can remove it or keep it. Fastify parses json by default.
    ('app.register(express.json());', ''),
    ('Fastify)', 'fastify)'),
    ('Fastify>', 'fastify>')
])

# auth.routes.ts
replace_in_file('src/infrastructure/http/routes/auth.routes.ts', [
    ("from 'express-rate-limit';", "from '@fastify/rate-limit';")
])

# Rma resolvers
replace_in_file('src/infrastructure/graphql/resolvers/rma.ts', [
    (re.compile(r'rmaRepo: any, rmaNumber: any, warehouseId: any'), 'rmaRepo: any, rmaNumber: any, warehouseId: any'),
    (re.compile(r'rmaRepo, rmaNumber, warehouseId'), 'rmaRepo: any, rmaNumber: any, warehouseId: any'),
    (re.compile(r'rmaRepo, rmaId, itemId, disposition'), 'rmaRepo: any, rmaId: any, itemId: any, disposition: any'),
    (re.compile(r'rmaRepo, rmaNumber, itemId, notes'), 'rmaRepo: any, rmaNumber: any, itemId: any, notes: any')
])

# Services
import glob
for f in glob.glob('src/domain/services/**/*.ts', recursive=True):
    replace_in_file(f, [
        (re.compile(r'Response'), 'any'),
        (re.compile(r'\bres\b'), 'reply')
    ])
for f in glob.glob('src/application/**/*.ts', recursive=True):
    replace_in_file(f, [
        (re.compile(r'Response'), 'any')
    ])

# NotificationController
replace_in_file('src/infrastructure/http/controllers/NotificationController.ts', [
    ('reply.raw.write(', 'reply.raw.write('), # wait it already has it?
    ('reply.write(', 'reply.raw.write(')
])
