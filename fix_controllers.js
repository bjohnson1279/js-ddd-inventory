const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // request.body as any
    content = content.replace(/request\.body(?! as any)/g, "(request.body as any)");
    content = content.replace(/request\.params(?! as any)/g, "(request.params as any)");
    content = content.replace(/request\.query(?! as any)/g, "(request.query as any)");

    // reply.status().json()
    content = content.replace(/res\.json\(/g, "reply.send(");
    content = content.replace(/res\.send\(/g, "reply.send(");
    content = content.replace(/res\.status\(/g, "reply.status(");

    // req.tenantId -> request.tenantId
    content = content.replace(/\breq\./g, "request.");
    content = content.replace(/\bres\./g, "reply.");

    // req as any -> request as any
    content = content.replace(/\(req as any\)/g, "(request as any)");

    // request.server['repository']
    // Since TS is strict, we just cast request.server as any
    content = content.replace(/request\.server\[(.*?)\]/g, "(request.server as any)[$1]");
    content = content.replace(/request\.server\.(.*?)Repository/g, "(request.server as any).$1Repository");

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

walkDir(path.join(__dirname, 'src/infrastructure/http/controllers'));
