const fs = require('fs');
const path = require('path');

function injectBeforeAll(dir) {
  fs.readdirSync(dir).forEach(f => {
    let p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      injectBeforeAll(p);
    } else if (p.endsWith('.ts')) {
      let content = fs.readFileSync(p, 'utf8');
      
      // Only inject if not already present
      if (content.includes('request((app') && !content.includes('await app.ready()')) {
        // Find the top-level describe block
        content = content.replace(/describe\(['"][^'"]+['"],\s*(?:async\s*)?\(\)\s*=>\s*\{/, "$&\n  beforeAll(async () => {\n    await app.ready();\n  });\n");
        fs.writeFileSync(p, content);
      }
    }
  });
}

injectBeforeAll('tests');
