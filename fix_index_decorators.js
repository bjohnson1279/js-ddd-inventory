const fs = require('fs');

let index = fs.readFileSync('src/index.ts', 'utf8');

index = index.replace(/app\.decorate\('([^']+)',/g, "if (!app.hasDecorator('$1')) app.decorate('$1',");
index = index.replace(/app\.decorate\("([^"]+)",/g, 'if (!app.hasDecorator("$1")) app.decorate("$1",');

fs.writeFileSync('src/index.ts', index);
