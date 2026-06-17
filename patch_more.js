const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/infrastructure/http/controllers/**/*.ts');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/res\.status\(400\)\.json\(\{\s*error:\s*error\s*instanceof\s*DomainException\s*\?\s*error\.message\s*:\s*([^,}]+)\s*\}\);/g,
  `res.status(400).json({ error: error instanceof DomainException ? error.message : $1 });`);

  // Actually wait, let me use a simpler regex.
  // We want to replace res.status(400).json({ error: error instanceof DomainException ? error.message : "Bad request" }); with what? It's ALREADY SECURE because it's checking `error instanceof DomainException`.

  // Let me re-read the vulnerability:
  // "API controllers returned raw error messages (`error.message`) in HTTP 500 and 400 responses unconditionally, leaking internal stack details or database states to end-users."
  // "Only explicit domain exceptions (`DomainException`) are safe to expose to users"

  // So `res.status(400).json({ error: error.message, type: error.name });` inside `if (error instanceof DomainException)` IS SECURE.
  // And `res.status(400).json({ error: error instanceof DomainException ? error.message : "Bad request" });` IS SECURE.

  // Let's find ANY OTHER error.message without `error instanceof DomainException` or `DomainException` check.
});
