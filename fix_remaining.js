const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    for (const [oldStr, newStr] of replacements) {
        if (oldStr instanceof RegExp) {
            content = content.replace(oldStr, newStr);
        } else {
            content = content.split(oldStr).join(newStr);
        }
    }
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed', filePath);
    }
}

function walkDir(dir) {
    for (const file of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.ts')) {
            replaceInFile(fullPath, [
                ["res.send(", "reply.send("],
                ["res.status(", "reply.status("],
                ["res.json(", "reply.send("],
                ["res.setHeader(", "reply.header("],
                ["request.app.get(", "(request.server as any)."],
                ["req.tenantId", "request.tenantId"],
                ["request.get('X-Shopify-Topic')", "request.headers['x-shopify-topic']"],
                ["request.get('X-Shopify-Hmac-Sha256')", "request.headers['x-shopify-hmac-sha256']"],
                ["request.get('X-Shopify-Shop-Domain')", "request.headers['x-shopify-shop-domain']"],
                ["req.user", "request.user"],
                ["reply.setHeader(", "reply.header("],
                ["reply.write(", "reply.raw.write("],
                ["request.on(", "request.raw.on("],
                [/\(req, res\)/g, "(request, reply)"],
                [/\bconst req\b/, "const request"],
                [/\bconst res\b/, "const reply"],
                ["request: FastifyRequest", "request: any"],
                ["reply: FastifyReply", "reply: any"],
                ["reply.raw.raw.write(", "reply.raw.write("]
            ]);
        }
    }
}
walkDir(path.join(__dirname, 'src/infrastructure/http/controllers'));
walkDir(path.join(__dirname, 'src/infrastructure/http/routes'));
walkDir(path.join(__dirname, 'src/infrastructure/http/middleware'));
