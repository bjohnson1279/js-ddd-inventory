const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

walkDir('tests', (filePath) => {
    if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;

        // supertest integration
        content = content.replace(/request\(app\)/g, 'request(app.server)');

        // if there's request(app.server) and no app.ready(), we might need to add it to beforeAll
        // but let's just try replacing first
        
        // express imports
        content = content.replace(/import express from ["']express["'];?/g, 'import fastify from "fastify";');
        content = content.replace(/const app = express\(\);?/g, 'const app = fastify();');
        content = content.replace(/import \{.*?Request.*?\} from ["']express["'];?/g, '');
        content = content.replace(/import \{.*?Response.*?\} from ["']express["'];?/g, '');
        
        // mock routes
        content = content.replace(/app\.use\(\(req, res, next\) => \{/g, 'app.addHook("preHandler", (req, res, next) => {');

        if (content !== original) {
            fs.writeFileSync(filePath, content);
        }
    }
});
