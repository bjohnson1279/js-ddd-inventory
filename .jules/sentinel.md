## 2026-06-26 - [Avoid Error Leakage]
**Vulnerability:** The application was exposing `error.message` for `DomainException` instances directly in `res.status(400)` responses across multiple controllers.
**Learning:** Even though `DomainException` signifies validated domain logic errors, exposing its dynamic message can leak internal state (like exact inventory numbers or specific failure reasons) to the client, constituting Information Disclosure.
**Prevention:** Always map domain exception details to a generic, static safe string (e.g., 'A domain error occurred') in the HTTP response, while ensuring the original error details are securely logged server-side (`console.error`) for troubleshooting.

## 2026-06-29 - [Fix SQL Injection Vulnerabilities]
**Vulnerability:** The application was using `$queryRawUnsafe` and `$executeRawUnsafe` in multiple places (`ForecastingController.ts` and `prisma.ts`) with string concatenation/interpolation.
**Learning:** This is a critical vulnerability as it allows for SQL injection if user input is passed into these strings.
**Prevention:** Always use Prisma's safe `$queryRaw` and `$executeRaw` with tagged template literals to automatically parameterize inputs, avoiding `Unsafe` methods entirely when dealing with dynamic data.

## 2026-07-02 - [Fix HTTP Parameter Pollution]
**Vulnerability:** The application was not explicitly validating that `req.query` parameters were strings, potentially allowing HTTP Parameter Pollution (HPP) by passing arrays or objects, which could cause application crashes or bypass certain logic.
**Learning:** This is a medium priority vulnerability that could lead to unexpected behavior when `req.query` objects are passed directly to `prisma.$queryRaw` or similar methods.
**Prevention:** Always validate that `req.query` values are of the expected primitive type (`typeof parameter === "string"`) before processing them in controllers.

## 2026-07-06 - [Fix Timing Attack Vulnerability in Password Verification]
**Vulnerability:** The `verifyPassword` function in `src/infrastructure/utils/security.ts` was comparing password hashes using the `===` operator instead of `crypto.timingSafeEqual()`.
**Learning:** Standard string comparison (`===`) returns `false` as soon as it encounters a character mismatch. An attacker can measure the time the comparison takes to determine how many characters of their guessed hash match the actual hash, eventually allowing them to deduce the actual hash.
**Prevention:** Always use `crypto.timingSafeEqual()` when comparing sensitive hashes or HMAC signatures to ensure the comparison takes a constant amount of time regardless of how many characters match.
