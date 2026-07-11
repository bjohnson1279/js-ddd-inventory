## 2026-06-26 - [Avoid Error Leakage]
**Vulnerability:** The application was exposing `error.message` for `DomainException` instances directly in `res.status(400)` responses across multiple controllers.
**Learning:** Even though `DomainException` signifies validated domain logic errors, exposing its dynamic message can leak internal state (like exact inventory numbers or specific failure reasons) to the client, constituting Information Disclosure.
**Prevention:** Always map domain exception details to a generic, static safe string (e.g., 'A domain error occurred') in the HTTP response, while ensuring the original error details are securely logged server-side (`console.error`) for troubleshooting.

## 2026-07-10 - Fix error handling exposing internal details in BarcodeController
**Vulnerability:** Raw backend error messages from DomainExceptions (error.message) were directly returned to the client in HTTP 404 responses.
**Learning:** Returning dynamic exception messages exposes potentially sensitive business logic or internal state details (like stock levels) to users.
**Prevention:** Always log dynamic errors server-side (console.error) and return a static, generic safe string ("Not registered") to the client.

## 2026-06-29 - [Fix SQL Injection Vulnerabilities]
**Vulnerability:** The application was using `$queryRawUnsafe` and `$executeRawUnsafe` in multiple places (`ForecastingController.ts` and `prisma.ts`) with string concatenation/interpolation.
**Learning:** This is a critical vulnerability as it allows for SQL injection if user input is passed into these strings.
**Prevention:** Always use Prisma's safe `$queryRaw` and `$executeRaw` with tagged template literals to automatically parameterize inputs, avoiding `Unsafe` methods entirely when dealing with dynamic data.
## 2026-07-10 - Stop Information Leakage in HTTP Error Responses
**Vulnerability:** HTTP 404 responses in `BarcodeController.ts` were explicitly returning the dynamic `error.message` from `DomainException` to the client when a scan failed (e.g., "Not registered").
**Learning:** Returning dynamic, backend-generated error messages directly in HTTP responses exposes internal application state and logic. This can aid attackers in mapping out the system or understanding business rules they shouldn't have access to.
**Prevention:** To prevent Information Disclosure, never expose raw backend error messages or stack traces directly to the client. Always log the dynamic error server-side using `console.error` (or a structured logger) for troubleshooting, and return a generic, static safe string (e.g., "Barcode not registered or invalid") in the JSON response payload.
