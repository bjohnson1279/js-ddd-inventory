import re

with open('src/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('const app = Fastify({ logger: true });', 'const app = fastify({ logger: true });')
content = content.replace('app.register(helmet);', 'app.register(fastifyHelmet);')
content = content.replace("app.register(cors, { origin: '*' });", "app.register(fastifyCors, { origin: '*' });")
content = content.replace('app.register(limiter);', '')

limiter_regex = re.compile(r'const limiter = fastifyRateLimit\(\{[\s\S]*?\}\);')
limiter_match = limiter_regex.search(content)
if limiter_match:
    limiter_opts = limiter_match.group(0).replace('const limiter = fastifyRateLimit(', '').rstrip(');')
    content = limiter_regex.sub('', content)
    content = content.replace('app.register(fastifyHelmet);', f'app.register(fastifyHelmet);\napp.register(fastifyRateLimit, {limiter_opts});')

content = re.sub(r'app\.register\("/api/shopify", express\.json\(\{[\s\S]*?\}\)\);', '', content)

with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

with open('src/infrastructure/http/routes/auth.routes.ts', 'r', encoding='utf-8') as f:
    auth = f.read()
auth = auth.replace("import { rateLimit } from 'express-rate-limit';", "import fastifyRateLimit from '@fastify/rate-limit';")
with open('src/infrastructure/http/routes/auth.routes.ts', 'w', encoding='utf-8') as f:
    f.write(auth)
