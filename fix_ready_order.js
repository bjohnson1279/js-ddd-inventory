const fs = require('fs');
const path = require('path');

function moveReady(dir) {
  fs.readdirSync(dir).forEach(f => {
    let p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      moveReady(p);
    } else if (p.endsWith('.ts')) {
      let content = fs.readFileSync(p, 'utf8');
      
      // If we have both setupApp and app.ready
      if (content.includes('setupApp(') && content.includes('await app.ready()')) {
        // Remove the injected beforeAll that my previous script added at the top of describe
        content = content.replace(/beforeAll\(async \(\) => \{\s*await app\.ready\(\);\s*\}\);\s*/g, '');
        // Inject await app.ready() immediately after setupApp(...) calls
        content = content.replace(/(setupApp\([^)]+\);)/g, "$1\n    await app.ready();");
        fs.writeFileSync(p, content);
      } else if (content.includes('app.register(') && content.includes('await app.ready()')) {
        // Same for app.register in tests
        content = content.replace(/beforeAll\(async \(\) => \{\s*await app\.ready\(\);\s*\}\);\s*/g, '');
        content = content.replace(/(app\.register\([^)]+\);)/g, "$1\n    await app.ready();");
        fs.writeFileSync(p, content);
      }
    }
  });
}

moveReady('tests');

// Also fix E2E.test.ts which has `app.get("costLayerRepository")`
let e2eTest = fs.readFileSync('tests/infrastructure/http/E2E.test.ts', 'utf8');
e2eTest = e2eTest.replace(/app\.get\(/g, '(app as any).'); // app.get in express gets config, fastify it registers a route
fs.writeFileSync('tests/infrastructure/http/E2E.test.ts', e2eTest);
