Ah, I need to start Postgres before running tests!
`Environment Setup Convention: The root backend test suite (npm test) requires a running PostgreSQL database. Start it using docker compose up -d (the V2 plugin, as the older docker-compose standalone binary is not available) before executing tests to prevent database connection errors.`

Alright, I will fix the parameter pollution in `InventoryController.ts`.

Let's look at what needs to be changed in `src/infrastructure/http/controllers/InventoryController.ts`.
We will modify two functions:
1) `getLevel`
2) `suggestFefoPick`

```typescript
// patch.js
const fs = require('fs');
const file = 'src/infrastructure/http/controllers/InventoryController.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'const locationId = (req.query.locationId as string) || "default";',
  'if (req.query.locationId !== undefined && typeof req.query.locationId !== "string") {\n        return res.status(400).json({ error: "Invalid locationId format" });\n      }\n      const locationId = req.query.locationId ? (req.query.locationId as string).trim() : "default";'
);

content = content.replace(
  'if (!sku || !quantity) {\n        return res.status(400).json({ error: "SKU and quantity are required query parameters" });\n      }',
  'if (!sku || !quantity) {\n        return res.status(400).json({ error: "SKU and quantity are required query parameters" });\n      }\n\n      if (typeof sku !== "string" || typeof quantity !== "string") {\n        return res.status(400).json({ error: "SKU and quantity must be valid strings" });\n      }'
);

content = content.replace(
  'const suggestions = await useCase.execute(sku as string, parseInt(quantity as string));',
  'const suggestions = await useCase.execute(sku.trim(), parseInt(quantity, 10));'
);

fs.writeFileSync(file, content);
```

Let's double check if I can just write this patch and use it.
The plan is:
1) **Understand the problem**: Identify the security issue. `Express req.query` parameter pollution (HPP) bypasses TS `as string` type casting, leading to potential NoSQL/Prisma crashes.
2) **Create Patch**: Write a Node.js patch script to safely validate `typeof req.query.sku === 'string'` and `typeof req.query.quantity === 'string'` in `InventoryController.ts`.
3) **Run Patch & Verify File**: Execute the script and read `InventoryController.ts` to ensure modifications were applied.
4) **Test Execution**: Start Postgres using `docker compose up -d`, inject secrets `SHOPIFY_API_SECRET=fake_secret JWT_SECRET=test npm test` to verify the test suite passes.
5) **Cleanup**: Delete the temporary patch script.
6) Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
7) **Submit**: Use `submit` to commit and push changes with a PR describing the security fix.
