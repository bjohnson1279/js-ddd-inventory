Let's review the Information Disclosure vulnerability again:
`Security Convention: To prevent Information Disclosure, never expose raw backend exception details (error.message or error.stack) in HTTP error responses (both 500s and 400s). Even validated domain exceptions (like DomainException) can contain sensitive business logic or state (e.g., internal stock levels). Always map these errors to generic, static safe strings (e.g., 'Insufficient stock') instead of returning the dynamic error.message directly.`

This is a specific memory for this codebase. I can write a `sed` script to replace ALL instances of `error: error.message` with `error: "A business rule violation occurred"` in all controllers.

```bash
find src/infrastructure/http/controllers/ -type f -exec sed -i 's/error: error.message, type: error.name/error: "A business rule violation occurred", type: error.name/g' {} +
```
This is a single command, fixing a widespread Information Disclosure vulnerability.
It perfectly matches the Sentinel philosophy:
- Fix MEDIUM/HIGH priority issue (Information disclosure).
- Follows security best practices (don't leak sensitive data).
- Less than 50 lines of code changes (it's a regex replace).

Wait, the memory specifically suggests "e.g., 'Insufficient stock' or 'Invalid accounting operation'".
If I replace it with `"A business rule violation occurred"`, it's safe.
But what about the tests? Will tests fail if they expect a specific error message?
Let's search the tests for `error.message`.
```bash
grep -rn "business rule" tests/
```
Tests usually expect `.toThrow()` or specific statuses. Let's check `tests/`.
