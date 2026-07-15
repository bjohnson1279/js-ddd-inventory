Wait, `tests/infrastructure/http/WarehouseLocationE2E.test.ts` checks if `res.body.error` contains "weight limit" and "volume limit"!
```typescript
tests/infrastructure/http/WarehouseLocationE2E.test.ts:178:      expect(res.body.error).toContain("weight limit");
tests/infrastructure/http/WarehouseLocationE2E.test.ts:192:      expect(res.body.error).toContain("volume limit");
```
If I replace `error.message` with `"A business rule violation occurred"`, these tests will FAIL.

Wait! The memory says: "Even validated domain exceptions (like DomainException) can contain sensitive business logic or state (e.g., internal stock levels). Always map these errors to generic, static safe strings (e.g., 'Insufficient stock') instead of returning the dynamic error.message directly."
It also says: "When creating test assertions for thrown errors, if the issue description explicitly specifies a generic error behavior (e.g., `throw new Error();`), strictly use generic assertions like `.toThrow()` or `.toThrow(Error)` in the test code. This avoids Groundedness Rule violations for hallucinated error strings, even if the actual file contains a specific error message string."

If I use `sed` to replace it, I will also need to update the tests.
Wait, what if I fix the parameter pollution in `InventoryController.ts`? It's much safer, less intrusive, and directly fixes a specific security gap (HPP type confusion). The prompt limits changes to <50 lines.

Let's look at `InventoryController.ts` `suggestFefoPick`:
```typescript
      const { sku, quantity } = req.query;

      if (!sku || !quantity) {
        return res.status(400).json({ error: "SKU and quantity are required query parameters" });
      }

      if (typeof sku !== "string" || typeof quantity !== "string") {
        return res.status(400).json({ error: "SKU and quantity must be valid strings" });
      }

      const useCase = new SuggestFefoPicking(productRepository, costLayerRepository);
      const suggestions = await useCase.execute(sku.trim(), parseInt(quantity, 10));
```
And `getLevel`:
```typescript
      if (req.query.locationId && typeof req.query.locationId !== "string") {
        return res.status(400).json({ error: "Invalid locationId parameter format" });
      }
      const locationId = req.query.locationId ? (req.query.locationId as string).trim() : "default";
```

Wait! Let me write a dedicated Node.js script to patch these Express `req.query` usages in `InventoryController.ts`.

Is there any other controller that has a clear type confusion?
Let's look at `ForecastingController.ts`:
```typescript
      const locationId = (req.query.locationId as string) || "default";
```
Let's patch this one too.

Let's check `SerialController.ts`:
```typescript
      const tenantId = (req.query.tenantId as string) || "DEFAULT";
```

I'll write a patch script that adds the explicit `typeof` checks to these specific spots, or I can just fix `InventoryController.ts` and focus entirely on it. The prompt says "ONE small security issue or add ONE security enhancement". So fixing `InventoryController.ts` parameter pollution is completely sufficient and fits in <50 lines!

Wait, is parameter pollution considered "ONE" issue if I fix it in one controller? Yes.

Let me verify if `pnpm test` and `pnpm lint` work first.
Let's run `npm install` and `npm test` since this is the root directory.
