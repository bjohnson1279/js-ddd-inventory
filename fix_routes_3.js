const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    const match = content.match(/export const (\w+)Router: FastifyPluginAsync/);
    if (match) {
        const routerName = match[1] + "Router";
        const regex = new RegExp(routerName + "\\.(get|post|put|patch|delete)", "g");
        content = content.replace(regex, "fastify.$1");
        const regexUse = new RegExp(routerName + "\\.use\\((.*?)\\);", "g");
        content = content.replace(regexUse, "fastify.addHook('preHandler', $1);");
    }
    
    // fastify.use
    content = content.replace(/fastify\.use\((.*?)\);/g, "fastify.addHook('preHandler', $1);");

    // Prehandler syntax fixes
    content = content.replace(/fastify\.(get|post|put|patch|delete)\(['"](.*?)['"],\s*(requireRole\(.*?\)|requirePermission\(.*?\)|authMiddleware),\s*(.*?)\);/g, 
        "fastify.$1('$2', { preHandler: [$3] }, $4);");

    // Fix duplicate preHandlers: { preHandler: [authMiddleware] }, { preHandler: [requirePermission(...)] }
    content = content.replace(/\{\s*preHandler:\s*\[(.*?)\]\s*\}, \s*\{\s*preHandler:\s*\[(.*?)\]\s*\}/g, "{ preHandler: [$1, $2] }");

    // Any missing requests
    content = content.replace(/\(req, reply\)/g, "(request: FastifyRequest, reply: FastifyReply)");
    content = content.replace(/\(req, res\)/g, "(request: FastifyRequest, reply: FastifyReply)");
    content = content.replace(/req\.body/g, "(request.body as any)");
    content = content.replace(/req\.params/g, "(request.params as any)");
    content = content.replace(/req\.query/g, "(request.query as any)");
    
    // As any for existing TS errors
    content = content.replace(/request\.body(?! as any)/g, "(request.body as any)");
    content = content.replace(/request\.params(?! as any)/g, "(request.params as any)");
    content = content.replace(/request\.query(?! as any)/g, "(request.query as any)");

    // reply.status(..).json
    content = content.replace(/res\.json\(/g, "reply.send(");
    content = content.replace(/res\.send\(/g, "reply.send(");
    content = content.replace(/res\.status\(/g, "reply.status(");

    // reply.status
    content = content.replace(/reply\.status\((.*?)\)\.send\((.*?)\)/g, "reply.status($1).send($2)");

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed ' + filePath);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.ts')) {
            processFile(fullPath);
        }
    }
}

walkDir(path.join(__dirname, 'src/infrastructure/http/routes'));
