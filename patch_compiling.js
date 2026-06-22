const fs = require('fs');
const filepath = 'webapp/src/App.tsx';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(
  '  const handleCreateKit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    setKitMsg(null);\n    try {',
  '  const handleCreateKit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    setCompilingKit(true);\n    setKitMsg(null);\n    try {'
);

content = content.replace(
  '    } catch (err) {\n      setKitMsg({ type: "error", text: "Connection issues." });\n    }',
  '    } catch (err) {\n      setKitMsg({ type: "error", text: "Connection issues." });\n    } finally {\n      setCompilingKit(false);\n    }'
);

fs.writeFileSync(filepath, content);
