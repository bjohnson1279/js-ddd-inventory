import re

# index.ts
with open('src/index.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('app.disable("x-powered-by");', '')
c = c.replace('windowMs:', 'timeWindow:')
c = c.replace('limit: process.env', 'max: process.env')
c = c.replace('app.set(', 'app.decorate(')
c = c.replace('app.listen(port,', 'app.listen({ port: typeof port === "string" ? parseInt(port) : port },')
c = c.replace("import { rateLimit } from 'express-rate-limit';", "")

# replace fastifyRateLimit options format
c = re.sub(r'const limiter = fastifyRateLimit\(\{[\s\S]*?\}\);', '', c)

with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(c)

# auth.routes.ts
with open('src/infrastructure/http/routes/auth.routes.ts', 'r', encoding='utf-8') as f:
    a = f.read()
a = a.replace("import { rateLimit } from 'express-rate-limit';", "")
with open('src/infrastructure/http/routes/auth.routes.ts', 'w', encoding='utf-8') as f:
    f.write(a)

# NotificationController.ts
with open('src/infrastructure/http/controllers/NotificationController.ts', 'r', encoding='utf-8') as f:
    nc = f.read()
nc = nc.replace('reply.raw.raw.write', 'reply.raw.write')
nc = nc.replace('reply.write(', 'reply.raw.write(')
with open('src/infrastructure/http/controllers/NotificationController.ts', 'w', encoding='utf-8') as f:
    f.write(nc)
