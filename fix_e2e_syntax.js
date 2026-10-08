const fs = require('fs');
let c = fs.readFileSync('tests/infrastructure/http/E2E.test.ts', 'utf8');
c = c.replace(/\(app as any\)\."([^"]+)"\);/g, '(app as any)["$1"];');
fs.writeFileSync('tests/infrastructure/http/E2E.test.ts', c);
