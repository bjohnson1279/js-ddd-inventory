const fs = require('fs');

const files = [
  {
    path: 'src/infrastructure/http/controllers/ForecastingController.ts',
    replacements: [
      {
        search: `      const locationId = request.query && (request.query as any).locationId ? ((request.query as any).locationId as string).trim() : "default";`,
        replace: `      const locationId = request.query && typeof (request.query as any).locationId === "string" ? ((request.query as any).locationId as string).trim() : "default";`
      },
      {
        search: `      const sku = request.query && (request.query as any).sku ? ((request.query as any).sku as string) : undefined;`,
        replace: `      const sku = request.query && typeof (request.query as any).sku === "string" ? ((request.query as any).sku as string) : undefined;`
      }
    ]
  },
  {
    path: 'src/infrastructure/http/controllers/InventoryController.ts',
    replacements: [
      {
        search: `      const locationId = request.query && (request.query as any).locationId ? ((request.query as any).locationId as string).trim() : "default";`,
        replace: `      const locationId = request.query && typeof (request.query as any).locationId === "string" ? ((request.query as any).locationId as string).trim() : "default";`
      },
      {
        search: `      const sku = (request.query as any).sku as string;`,
        replace: `      const sku = typeof (request.query as any).sku === "string" ? (request.query as any).sku as string : "";`
      },
      {
        search: `      const quantity = (request.query as any).quantity as string;`,
        replace: `      const quantity = typeof (request.query as any).quantity === "string" ? (request.query as any).quantity as string : "";`
      }
    ]
  },
  {
    path: 'src/infrastructure/http/controllers/SerialController.ts',
    replacements: [
      {
        search: `      const tenantId = request.query && (request.query as any).tenantId ? ((request.query as any).tenantId as string).trim() : "DEFAULT";`,
        replace: `      const tenantId = request.query && typeof (request.query as any).tenantId === "string" ? ((request.query as any).tenantId as string).trim() : "DEFAULT";`
      }
    ]
  },
  {
    path: 'src/infrastructure/http/controllers/AccountingController.ts',
    replacements: [
      {
        search: `      const tenantId = request.query && (request.query as any).tenantId ? ((request.query as any).tenantId as string).trim() || undefined : undefined;`,
        replace: `      const tenantId = request.query && typeof (request.query as any).tenantId === "string" ? ((request.query as any).tenantId as string).trim() || undefined : undefined;`
      },
      {
        search: `      const parsedQuantity = request.query && (request.query as any).quantity !== undefined ? parseInt((request.query as any).quantity as string, 10) : NaN;`,
        replace: `      const parsedQuantity = request.query && typeof (request.query as any).quantity === "string" ? parseInt((request.query as any).quantity as string, 10) : NaN;`
      },
      {
        search: `      let tenantId = request.query && (request.query as any).tenantId ? ((request.query as any).tenantId as string).trim() : "";`,
        replace: `      let tenantId = request.query && typeof (request.query as any).tenantId === "string" ? ((request.query as any).tenantId as string).trim() : "";`
      },
      {
        search: `      let method = request.query && (request.query as any).method ? ((request.query as any).method as string).trim() : "";`,
        replace: `      let method = request.query && typeof (request.query as any).method === "string" ? ((request.query as any).method as string).trim() : "";`
      }
    ]
  },
  {
    path: 'src/infrastructure/http/controllers/ReorderPolicyController.ts',
    replacements: [
      {
        search: `      const locationId = request.query && (request.query as any).locationId ? ((request.query as any).locationId as string).trim() : undefined;`,
        replace: `      const locationId = request.query && typeof (request.query as any).locationId === "string" ? ((request.query as any).locationId as string).trim() : undefined;`
      }
    ]
  },
  {
    path: 'src/infrastructure/http/controllers/OutboxController.ts',
    replacements: [
      {
        search: `      const limit = request.query && (request.query as any).limit ? parseInt((request.query as any).limit as string, 10) : 50;`,
        replace: `      const limit = request.query && typeof (request.query as any).limit === "string" ? parseInt((request.query as any).limit as string, 10) : 50;`
      },
      {
        search: `      const maxAttempts = request.query && (request.query as any).maxAttempts ? parseInt((request.query as any).maxAttempts as string, 10) : 5;`,
        replace: `      const maxAttempts = request.query && typeof (request.query as any).maxAttempts === "string" ? parseInt((request.query as any).maxAttempts as string, 10) : 5;`
      }
    ]
  },
  {
    path: 'src/infrastructure/http/routes/aging.routes.ts',
    replacements: [
      {
        search: `    const days = parseInt((request.query as any).days as string) || 180;`,
        replace: `    const days = typeof (request.query as any).days === "string" ? parseInt((request.query as any).days as string) : 180;`
      }
    ]
  },
  {
    path: 'src/infrastructure/http/controllers/ShippingController.ts',
    replacements: [
      {
        search: `      const { sku, quantity, address } = (request.query as any);`,
        replace: `      const { sku, quantity, address } = typeof request.query === "object" && request.query ? (request.query as any) : {};\n      if (sku !== undefined && typeof sku !== "string" || quantity !== undefined && typeof quantity !== "string" || address !== undefined && typeof address !== "string") { return reply.status(400).send({ error: "Invalid query parameters" }); }`
      }
    ]
  }
];

for (const file of files) {
  if (fs.existsSync(file.path)) {
    let content = fs.readFileSync(file.path, 'utf8');
    for (const r of file.replacements) {
      content = content.split(r.search).join(r.replace);
    }
    fs.writeFileSync(file.path, content);
  }
}
