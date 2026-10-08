const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    let p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.ts')) {
      let content = fs.readFileSync(p, 'utf8');
      let original = content;

      content = content.replace(/app\.use\(express\.json\(\)\);?/g, '');
      content = content.replace(/app\.use\("([^"]+)",\s*([a-zA-Z0-9_]+)\);?/g, 'app.register($2, { prefix: "$1" });');
      content = content.replace(/app\.use\('([^']+)',\s*([a-zA-Z0-9_]+)\);?/g, "app.register($2, { prefix: '$1' });");
      content = content.replace(/import express from "express";?/g, '');

      if (content !== original) {
        fs.writeFileSync(p, content);
      }
    }
  });
}

walk('tests');
