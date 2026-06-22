const fs = require('fs');
const filepath = 'webapp/src/App.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// I replaced the wrong function?
// Let's check handleCompileKit
