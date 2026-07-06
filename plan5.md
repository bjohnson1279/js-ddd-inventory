The memory clearly highlights Information Disclosure via HTTP error messages as a known security convention violation:
`Security Convention: To prevent Information Disclosure, never expose raw backend exception details (error.message or error.stack) in HTTP error responses (both 500s and 400s). Even validated domain exceptions (like DomainException) can contain sensitive business logic or state (e.g., internal stock levels). Always map these errors to generic, static safe strings (e.g., 'Insufficient stock') instead of returning the dynamic error.message directly.`

Since `InventoryController.ts` exposes `error.message` in MULTIPLE places, and doing it globally or doing it for `InventoryController` will make it >50 lines if I manually edit every catch block, I can use a global error handling middleware in Express, or just fix `error.message` in `InventoryController.ts` using `sed` or simple patch!
Wait, if I use `sed` to replace `{ error: error.message, type: error.name }` with `{ error: "An error occurred", type: error.name }`, it's just one line of sed and <50 lines of diff!

Let's check how many files have this pattern:
`grep -rn "error.message, type: error.name" src/`
This pattern is in:
`ForecastingController.ts`
`NotificationController.ts`
`InventoryController.ts`
`OnboardingController.ts`
`PurchaseOrderController.ts`
`BarcodeController.ts`
`ShippingController.ts`
`SerialController.ts`
`ReorderPolicyController.ts`
`OutboxController.ts`

If I just change it globally using `sed`, the diff would touch 10 files and maybe 30 lines.
Is touching 10 files allowed for <50 lines? Yes.
Wait, what if the memory wants me to use a specific generic message for DomainExceptions?
"Always map these errors to generic, static safe strings (e.g., 'Insufficient stock') instead of returning the dynamic error.message directly."

Wait, what if I fix the parameter pollution in ONE controller?
If the prompt says "Fix ONE small security issue or add ONE security enhancement", maybe I can just fix the HPP type confusion in `InventoryController.ts`?
The memory states:
`Security/Input Validation Convention: When implementing API controllers, do not implicitly trust req.body or req.query. Express req.query parameters can be parsed as arrays or objects, which bypasses TypeScript as string assertions at runtime and can cause NoSQL/Prisma query injection or HTTP Parameter Pollution (HPP). Always implement explicit runtime type checking (e.g., typeof value === 'string') and boundary assertions (e.g., .trim(), Number.isInteger()) before passing data to domain use cases.`

If I fix `express req.query` in `InventoryController.ts` for `suggestFefoPick`:
```typescript
<<<<<<< SEARCH
  static async suggestFefoPick(req: Request, res: Response) {
    try {
      const productRepository = req.app.get("productRepository");
      const costLayerRepository = req.app.get("costLayerRepository");
      const { sku, quantity } = req.query;

      if (!sku || !quantity) {
        return res.status(400).json({ error: "SKU and quantity are required query parameters" });
      }

      const useCase = new SuggestFefoPicking(productRepository, costLayerRepository);
      const suggestions = await useCase.execute(sku as string, parseInt(quantity as string));
=======
  static async suggestFefoPick(req: Request, res: Response) {
    try {
      const productRepository = req.app.get("productRepository");
      const costLayerRepository = req.app.get("costLayerRepository");
      const { sku, quantity } = req.query;

      if (!sku || !quantity || typeof sku !== "string" || typeof quantity !== "string") {
        return res.status(400).json({ error: "SKU and quantity must be valid strings" });
      }

      const useCase = new SuggestFefoPicking(productRepository, costLayerRepository);
      const suggestions = await useCase.execute(sku.trim(), parseInt(quantity, 10));
>>>>>>> REPLACE
```

Wait, `InventoryController` also has `req.query.locationId` in `list` and `getLevel`.
```typescript
<<<<<<< SEARCH
  static async getLevel(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { sku } = req.params;
      const locationId = (req.query.locationId as string) || "default";
=======
  static async getLevel(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { sku } = req.params;
      if (req.query.locationId !== undefined && typeof req.query.locationId !== "string") {
        return res.status(400).json({ error: "Invalid locationId format" });
      }
      const locationId = req.query.locationId ? (req.query.locationId as string).trim() : "default";
>>>>>>> REPLACE
```
This is only two functions in `InventoryController`. I can easily fix this.

Let's check `ForecastingController.ts`.
```typescript
<<<<<<< SEARCH
      const locationId = (req.query.locationId as string) || "default";
=======
      if (req.query.locationId !== undefined && typeof req.query.locationId !== "string") {
        return res.status(400).json({ error: "Invalid locationId format" });
      }
      const locationId = req.query.locationId ? (req.query.locationId as string).trim() : "default";
>>>>>>> REPLACE
```

Wait, the prompt says "Sentinel's Philosophy: Security is everyone's responsibility... Add input sanitization where missing".
If I just add an Express middleware that generically blocks array/object `req.query`, it fixes the issue for ALL endpoints and is very small.
```typescript
// in src/index.ts
app.use((req, res, next) => {
  for (const key in req.query) {
    if (typeof req.query[key] !== "string") {
      return res.status(400).json({ error: `Invalid format for query parameter: ${key}` });
    }
  }
  next();
});
```
Wait! Does any controller expect an array?
Let's see if any route uses arrays in `req.query`.
I searched for `req.query` and only found scalar usages (`sku`, `quantity`, `locationId`, `limit`, `maxAttempts`, `tenantId`, `method`, `address`).
None of them expect an array.

Wait! The prompt memory says:
`Express req.query parameters can be parsed as arrays or objects... Always implement explicit runtime type checking (e.g., typeof value === 'string') and boundary assertions (e.g., .trim(), Number.isInteger()) before passing data to domain use cases.`

Wait, the memory specifically says "When implementing API controllers... Always implement explicit runtime type checking...".
This means we should do it in the controllers explicitly, not globally.
Let's do it in `InventoryController.ts`.
