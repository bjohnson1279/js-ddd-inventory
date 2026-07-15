In `InventoryController.ts`, `suggestFefoPick`:
```typescript
      const { sku, quantity } = req.query;

      if (!sku || !quantity) {
        return res.status(400).json({ error: "SKU and quantity are required query parameters" });
      }

      const useCase = new SuggestFefoPicking(productRepository, costLayerRepository);
      const suggestions = await useCase.execute(sku as string, parseInt(quantity as string));
```
Here, `sku as string` is used. If `sku` is `["sku1", "sku2"]`, this will bypass the compiler and pass an array to `useCase.execute()`, which will then pass it to repositories and likely cause a Prisma crash or NoSQL/Prisma query injection. This perfectly matches the memory.

Let's check `src/infrastructure/http/controllers/AccountingController.ts`:
```typescript
      if (req.query.tenantId !== undefined && typeof req.query.tenantId !== "string") {
        return res.status(400).json({ error: "Invalid tenantId parameter." });
      }
```
This is explicitly guarded in `AccountingController.ts`. So `InventoryController.ts` is missing these explicit type checks.

Wait, the memory also mentioned "Security Convention: To prevent Information Disclosure, never expose raw backend exception details (error.message or error.stack) in HTTP error responses (both 500s and 400s). ... Always map these errors to generic, static safe strings (e.g., 'Insufficient stock') instead of returning the dynamic error.message directly."

Which one should I fix? I should pick ONE. I will fix the Information Disclosure vulnerability (exposing `error.message`), since it appears universally across many controllers and I can replace the logic in ONE controller (`InventoryController.ts`) or `ForecastingController.ts`. Wait, the memory says "Even validated domain exceptions (like DomainException) can contain sensitive business logic or state (e.g., internal stock levels). Always map these errors to generic, static safe strings (e.g., 'Insufficient stock') instead of returning the dynamic error.message directly."

If I change `InventoryController.ts` error handling:
```typescript
<<<<<<< SEARCH
    } catch (error: any) {
      if (error instanceof DomainException) {
        res.status(400).json({ error: error.message, type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
=======
    } catch (error: any) {
      if (error instanceof DomainException) {
        res.status(400).json({ error: "Invalid inventory operation", type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
>>>>>>> REPLACE
```
But `InventoryController.ts` has 10 of these catch blocks. It's >50 lines if I replace all of them! I am constrained to <50 lines.

What if I fix the parameter pollution in `InventoryController.ts`?
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
        return res.status(400).json({ error: "SKU and quantity must be valid string parameters" });
      }

      const useCase = new SuggestFefoPicking(productRepository, costLayerRepository);
      const suggestions = await useCase.execute(sku, parseInt(quantity));
>>>>>>> REPLACE
```
Also `locationId` in `getLevel`:
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

      if (req.query.locationId && typeof req.query.locationId !== "string") {
        return res.status(400).json({ error: "Invalid locationId parameter" });
      }
      const locationId = (req.query.locationId as string) || "default";
>>>>>>> REPLACE
```
This is around 15 lines of changes! And it perfectly aligns with the security memory.

Is there any other missing type checks for `req.query`?
Let's look at `ForecastingController.ts`:
```typescript
<<<<<<< SEARCH
      const locationId = (req.query.locationId as string) || "default";
      const report = await useCase.execute(locationId);
=======
      if (req.query.locationId && typeof req.query.locationId !== "string") {
        return res.status(400).json({ error: "Invalid locationId parameter format" });
      }
      const locationId = (req.query.locationId as string) || "default";
      const report = await useCase.execute(locationId);
>>>>>>> REPLACE
```

Wait! Is there an Express middleware we can add?
If I add a small middleware to validate all `req.query`?
```typescript
// queryTypeValidation.ts
export function queryTypeValidation(req: Request, res: Response, next: NextFunction) {
  for (const key in req.query) {
    if (typeof req.query[key] !== "string") {
      return res.status(400).json({ error: `Invalid query parameter format for ${key}` });
    }
  }
  next();
}
```
And add it to `src/index.ts`?
```typescript
<<<<<<< SEARCH
  app.use(express.json());

  // Register Domain Event Handlers
=======
  app.use(express.json());

  app.use((req, res, next) => {
    for (const key in req.query) {
      if (req.query[key] !== undefined && typeof req.query[key] !== "string") {
        return res.status(400).json({ error: `Invalid format for query parameter: ${key}` });
      }
    }
    next();
  });

  // Register Domain Event Handlers
>>>>>>> REPLACE
```
Wait! Does `req.query` ever contain arrays intentionally?
Like `?tags=a&tags=b` -> `{ tags: ['a', 'b'] }`.
If I block all arrays globally, it could break features that expect arrays!
Let's see if any route expects an array in `req.query`.
