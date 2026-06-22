const fs = require('fs');
const filepath = 'webapp/src/App.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Add loading state for Gen Code-128
content = content.replace(
  '  const [barcodeSearch, setBarcodeSearch] = useState("");',
  '  const [barcodeSearch, setBarcodeSearch] = useState("");\n  const [genLoading, setGenLoading] = useState(false);'
);

content = content.replace(
  '  const handleGenerateBarcode = async () => {\n    setBarcodeMsg(null);\n    try {',
  '  const handleGenerateBarcode = async () => {\n    setGenLoading(true);\n    setBarcodeMsg(null);\n    try {'
);

content = content.replace(
  '      setBarcodeMsg({ type: "error", text: "API Connection issue." });\n    }\n  };',
  '      setBarcodeMsg({ type: "error", text: "API Connection issue." });\n    } finally {\n      setGenLoading(false);\n    }\n  };'
);

content = content.replace(
  '<button type="button" className="btn btn-secondary" style={{ padding: "0 15px" }} onClick={handleGenerateBarcode}>\n                    Gen Code-128\n                  </button>',
  '<button type="button" className="btn btn-secondary" style={{ padding: "0 15px" }} onClick={handleGenerateBarcode} disabled={genLoading} aria-busy={genLoading} title={genLoading ? "Generating barcode..." : "Generate a new Code-128 barcode"}>\n                    {genLoading ? "⏳ Gen" : "Gen Code-128"}\n                  </button>'
);

// 2. Add loading state for Compile Formula (kits)
content = content.replace(
  '  const [kitMsg, setKitMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);',
  '  const [kitMsg, setKitMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);\n  const [compilingKit, setCompilingKit] = useState(false);'
);

content = content.replace(
  '  const handleCompileKit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    setKitMsg(null);\n    try {',
  '  const handleCompileKit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    setCompilingKit(true);\n    setKitMsg(null);\n    try {'
);

content = content.replace(
  '      setKitMsg({ type: "error", text: "API Connection issue." });\n    }\n  };',
  '      setKitMsg({ type: "error", text: "API Connection issue." });\n    } finally {\n      setCompilingKit(false);\n    }\n  };'
);

content = content.replace(
  '<button type="submit" className="btn btn-primary">\n                  Compile Formula\n                </button>',
  '<button type="submit" className="btn btn-primary" disabled={compilingKit} aria-busy={compilingKit} title={compilingKit ? "Compiling kit formula..." : "Compile the kit formula"}>\n                  {compilingKit ? "⏳ Compiling..." : "Compile Formula"}\n                </button>'
);

fs.writeFileSync(filepath, content);
