import os
import re
import sys

def migrate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # 1. Imports
    content = re.sub(
        r'import \{?.*?\}? from "express";',
        r'import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";',
        content
    )
    content = re.sub(
        r'import express(?:, \{.*?\})? from "express";',
        r'import Fastify, { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";',
        content
    )

    # 2. Types
    content = re.sub(r'\bRequest\b', 'FastifyRequest', content)
    content = re.sub(r'\bResponse\b', 'FastifyReply', content)
    content = re.sub(r'\bNextFunction\b', '() => void', content)

    # 3. Method signature replacements
    content = re.sub(r'\(req: FastifyRequest, res: FastifyReply\)', '(request: FastifyRequest, reply: FastifyReply)', content)
    content = re.sub(r'\(req: FastifyRequest, res: FastifyReply, next: \(\) => void\)', '(request: FastifyRequest, reply: FastifyReply, next: () => void)', content)
    content = re.sub(r'\(req: AuthenticatedRequest, res: FastifyReply', '(request: AuthenticatedRequest, reply: FastifyReply', content)
    content = re.sub(r'\(req: AuthenticatedRequest, res: FastifyReply, next: \(\) => void\)', '(request: AuthenticatedRequest, reply: FastifyReply, next: () => void)', content)

    # req/res -> request/reply in body
    # This is trickier, we need to replace standalone req and res. 
    # Let's replace res.status -> reply.status, res.json -> reply.send
    # req.app.get -> request.server...
    content = re.sub(r'\bres\.status\(', 'reply.status(', content)
    content = re.sub(r'\bres\.json\(', 'reply.send(', content)
    content = re.sub(r'\bres\.send\(', 'reply.send(', content)
    content = re.sub(r'\breq\.body\b', 'request.body', content)
    content = re.sub(r'\breq\.params\b', 'request.params', content)
    content = re.sub(r'\breq\.query\b', 'request.query', content)
    content = re.sub(r'\breq\.headers\b', 'request.headers', content)
    content = re.sub(r'\breq\.user\b', 'request.user', content)
    content = re.sub(r'\breq\.tenantId\b', 'request.tenantId', content)
    
    # replace req.app.get("...")
    content = re.sub(r'req\.app\.get\((.*?)\)', r'request.server[\1]', content)
    # also for request.app.get
    content = re.sub(r'request\.app\.get\((.*?)\)', r'request.server[\1]', content)
    
    # Fastify req doesn't have `res`
    # Fastify uses `request.raw` for IncomingMessage.
    
    # Router files:
    if 'Router()' in content or 'Router' in content:
        content = re.sub(r'const router = Router\(\);', 'const router: FastifyPluginAsync = async (fastify) => {', content)
        content = re.sub(r'export default router;', '};\nexport default router;', content)
        content = re.sub(r'router\.', 'fastify.', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")


def scan_directory(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.ts') and not file.endswith('.d.ts'):
                migrate_file(os.path.join(root, file))


if __name__ == "__main__":
    scan_directory(sys.argv[1])
