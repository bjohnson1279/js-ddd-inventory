const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/\(req as any\)/g, "(request as any)");
    
    // fix requirePermission directly
    content = content.replace(/,\s*requirePermission\((.*?)\),\s*async/g, ", { preHandler: [requirePermission($1)] }, async");
    content = content.replace(/,\s*requireRole\((.*?)\),\s*async/g, ", { preHandler: [requireRole($1)] }, async");
    content = content.replace(/,\s*authMiddleware,\s*async/g, ", { preHandler: [authMiddleware] }, async");

    // also for non async
    content = content.replace(/,\s*requirePermission\((.*?)\),\s*\(/g, ", { preHandler: [requirePermission($1)] }, (");
    content = content.replace(/,\s*requireRole\((.*?)\),\s*\(/g, ", { preHandler: [requireRole($1)] }, (");
    content = content.replace(/,\s*authMiddleware,\s*\(/g, ", { preHandler: [authMiddleware] }, (");

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
