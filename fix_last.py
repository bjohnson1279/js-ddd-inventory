import os
import re
import glob

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
    (re.compile(r'\breq\b'), 'request'),
    ('import { rateLimit } from "express-rate-limit";', 'import fastifyRateLimit from "@fastify/rate-limit";'),
    ('import express from "express";', 'import fastify from "fastify";'),
    ('import cors from "cors";', 'import fastifyCors from "@fastify/cors";'),
    ('import helmet from "helmet";', 'import fastifyHelmet from "@fastify/helmet";'),
    ('app.use(cors());', 'app.register(fastifyCors);'),
    ('app.use(helmet());', 'app.register(fastifyHelmet);'),
    ('app.use(', 'app.register(')
])

# Rma resolvers
replace_in_file('src/infrastructure/graphql/resolvers/rma.ts', [
    (re.compile(r'\(rmaRepo, rmaNumber, warehouseId\)'), '(rmaRepo: any, rmaNumber: any, warehouseId: any)'),
    (re.compile(r'\(rmaRepo, rmaId, itemId, disposition\)'), '(rmaRepo: any, rmaId: any, itemId: any, disposition: any)'),
    (re.compile(r'\(rmaRepo, rmaNumber, itemId, notes\)'), '(rmaRepo: any, rmaNumber: any, itemId: any, notes: any)')
])

# Controllers
for f in glob.glob('src/infrastructure/http/controllers/**/*.ts', recursive=True):
    replace_in_file(f, [
        (re.compile(r'\bres\b'), 'reply'),
        (re.compile(r'\breq\b'), 'request'),
        ('reply.setHeader(', 'reply.header('),
        ('reply.write(', 'reply.raw.write('),
        ('request.on(', 'request.raw.on('),
        ('recentFailureply', 'recentFailures')
    ])

# Services
for f in glob.glob('src/application/**/*.ts', recursive=True):
    replace_in_file(f, [
        (re.compile(r'\bres\b'), 'reply'),
        (re.compile(r'\breq\b'), 'request')
    ])
for f in glob.glob('src/domain/**/*.ts', recursive=True):
    replace_in_file(f, [
        (re.compile(r'\bres\b'), 'reply'),
        (re.compile(r'\breq\b'), 'request')
    ])

# Routes
replace_in_file('src/infrastructure/http/routes/auth.routes.ts', [
    ("import { rateLimit } from 'express-rate-limit';", "import fastifyRateLimit from '@fastify/rate-limit';")
])
