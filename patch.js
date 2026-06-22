const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/infrastructure/http/controllers/**/*.ts');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/catch \((error|err): any\) {\n\s*if \(\1 instanceof DomainException\) {\n\s*res\.status\(400\)\.json\({ error: \1\.message, type: \1\.name }\);\n\s*} else {\n\s*console\.error\(\1\);\n\s*res\.status\(500\)\.json\({ error: "Internal server error" }\);\n\s*}\n\s*}/g,
  `catch ($1: any) {
      if ($1 instanceof DomainException) {
        res.status(400).json({ error: $1.message, type: $1.name });
      } else {
        console.error($1);
        res.status(500).json({ error: "Internal server error" });
      }
    }`);

  // Also check for the variant where it just does console.error
    content = content.replace(/catch \((error|err): any\) {\n\s*console\.error\(\1\);\n\s*res\.status\(500\)\.json\({ error: "Internal server error" }\);\n\s*}/g,
  `catch ($1: any) {
      console.error($1);
      res.status(500).json({ error: "Internal server error" });
    }`);

  fs.writeFileSync(file, content);
});
