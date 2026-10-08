import re

with open('src/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('app.register(authMiddleware);', "app.addHook('preHandler', authMiddleware);")

# Fix `app.get("/api/admin/cache/stats", requireRole(["admin"]),`
content = re.sub(r'(app\.(?:get|post|put|delete|patch))\(([^,]+),\s*requireRole\(([^)]+)\),\s*\(request', r'\1(\2, { preHandler: [requireRole(\3)] }, (request', content)

# Fix `reply.status(200).json`
content = content.replace('reply.status(200).json', 'reply.status(200).send')
content = content.replace('reply.status(500).json', 'reply.status(500).send')
content = content.replace('reply.status(400).json', 'reply.status(400).send')
content = content.replace('reply.status(201).json', 'reply.status(201).send')

with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

with open('src/infrastructure/http/routes/auth.routes.ts', 'r', encoding='utf-8') as f:
    auth = f.read()

auth = auth.replace("import { rateLimit } from 'express-rate-limit';", "")
with open('src/infrastructure/http/routes/auth.routes.ts', 'w', encoding='utf-8') as f:
    f.write(auth)
