const fs = require('fs');
const path = require('path');

function fixAll(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fixAll(fullPath);
        } else if (file.endsWith('.ts')) {
            const original = fs.readFileSync(fullPath, 'utf8');
            let content = original;
            
            // replace .json( with .send(
            content = content.replace(/\.json\(/g, '.send(');
            
            // also let's replace Express Router with FastifyPluginAsync in routes that still have it
            if (fullPath.includes('routes') && content.includes('import { Router } from "express";')) {
                content = content.replace('import { Router } from "express";', 'import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";');
                content = content.replace(/export const .*?Router = Router\(\);/g, 'export const $&'); // wait
            }

            if (content !== original) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Fixed ' + fullPath);
            }
        }
    }
}

fixAll(path.join(__dirname, 'src'));
