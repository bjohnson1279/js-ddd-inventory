const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Fix imports
    content = content.replace(/import \{.*?\} from ['"]express['"];/g, "import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';");
    content = content.replace(/import \w+ from ['"]express-rate-limit['"];/g, "");

    // Fix router declaration
    content = content.replace(/export const (\w+)Router = Router\(\);/g, "export const $1Router: FastifyPluginAsync = async (fastify) => {\n");
    if (original !== content && content.includes("FastifyPluginAsync")) {
        // Need to close the plugin function at the end
        content += "\n};\n";
    }

    // Replace old express middleware patterns missed
    // e.g. fastify.post('/approve', requireRole(['admin']), (req, res) => ...
    content = content.replace(/fastify\.(get|post|put|patch|delete)\(['"](.*?)['"],\s*(requireRole\(.*?\)|requirePermission\(.*?\)|authMiddleware),\s*(.*?)\);/g, 
        "fastify.$1('$2', { preHandler: [$3] }, $4);");

    // Fix missing req/reply
    content = content.replace(/\(req, res\)/g, "(request: FastifyRequest, reply: FastifyReply)");
    content = content.replace(/\(req: Request, res: Response\)/g, "(request: FastifyRequest, reply: FastifyReply)");
    
    // Fix res.json, res.send, res.status
    content = content.replace(/res\.json\(/g, "reply.send(");
    content = content.replace(/res\.send\(/g, "reply.send(");
    content = content.replace(/res\.status\(/g, "reply.status(");

    // Some places use reply but parameter is missing or named res
    content = content.replace(/reply\.status/g, "reply.status"); 

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
