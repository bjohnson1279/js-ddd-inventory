const fs = require('fs');
const glob = require('glob');
const files = glob.sync('src/infrastructure/http/controllers/**/*.ts');
files.forEach(f => {
    let c = fs.readFileSync(f, 'utf8');
    c = c.replace(/\(request\.server as any\)\.\s*[\'\"]([^\'\"]+)[\'\"]\s*,\s*\)/g, '(request.server as any).$1');
    fs.writeFileSync(f, c);
});
