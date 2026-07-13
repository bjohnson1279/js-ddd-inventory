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

## 2024-03-22 - [Document Hallucinatory Hardcoded Fallback Secret]
**Vulnerability:** Hallucinatory hardcoded secret
**Learning:** Always verify the actual codebase state instead of blindly trusting automated task descriptions. In this case, the codebase already checked for the required environment variable and threw an error if missing.
**Prevention:** Rely on `cat`, `read_file`, or similar tools to examine the source files directly before writing execution plans or making changes.

## 2024-06-12 - Prevent Information Leakage in API Controllers
**Vulnerability:** API controllers returned raw error messages (`error.message`) in HTTP 500 and 400 responses unconditionally, leaking internal stack details or database states to end-users.
**Learning:** Exposing dynamic backend error messages directly in unhandled exception blocks is a medium/high severity risk. Only explicit domain exceptions (`DomainException`) are safe to expose to users, as their payloads are controlled.
**Prevention:** Standardize a pattern across API handlers. Never use `res.status(500).json({ error: error.message });`. Always fallback to generic descriptions (e.g. "Internal server error") or wrap the validation with a domain-specific error class.

## 2024-06-13 - Replace insecure Math.random() with crypto.randomInt() in MockCarrierService
**Vulnerability:** Used Math.random() to generate tracking number suffixes in MockCarrierService.
**Learning:** Math.random() is not a cryptographically secure pseudo-random number generator (CSPRNG), making identifiers generated this way predictable.
**Prevention:** Always use Node's native crypto utilities (like crypto.randomInt() or crypto.randomUUID()) when generating random identifiers to ensure unpredictability and security.

## 2024-06-20 - Prevent Information Leakage in API Controllers
**Vulnerability:** API controllers returned raw error messages (`error.message`) in HTTP 500 responses unconditionally, leaking internal stack details or database states to end-users.
**Learning:** Exposing dynamic backend error messages directly in unhandled exception blocks is a medium/high severity risk. Only explicit domain exceptions (`DomainException`) are safe to expose to users, as their payloads are controlled.
**Prevention:** Standardize a pattern across API handlers. Never use `res.status(500).json({ error: error.message });`. Always fallback to generic descriptions (e.g. "Internal server error") or wrap the validation with a domain-specific error class.

## 2024-11-20 - Hallucinatory CORS Vulnerability Report
**Vulnerability:** Reported overly permissive CORS policy, but analysis confirmed the application already securely uses environment variables to specify allowed origins.
**Learning:** Automated security reports or tasks may occasionally hallucinate or incorrectly flag secure implementations.
**Prevention:** Always verify the actual codebase state and data flow before implementing assumed fixes to avoid introducing unnecessary changes or regressions.

## 2025-02-18 - Remove Sensitive Console Logging in QuickBooks Client
**Vulnerability:** Sensitive API payload and integration URLs were being logged to the console via `console.log`, potentially exposing financial data and internal architecture.
**Learning:** Using verbose console logs for API integrations can expose sensitive data in production environments, creating a security risk.
**Prevention:** Avoid verbose logging of API payloads or URLs. If logging is necessary, use a structured logging mechanism that appropriately redacts sensitive fields and ensure that debug-level logs are not active in production.

## 2026-06-04 - Fix Timing Attack in Webhook HMAC Validation
**Vulnerability:** The Shopify webhook signature validation in `ShopifyWebhookSecurity.ts` used a standard string equality operator (`hash === hmac`).
**Learning:** Using simple string comparison for cryptographic hashes enables timing attacks, where an attacker can theoretically infer the correct HMAC by observing response times, bypassing webhook authenticity checks.
**Prevention:** Always use `crypto.timingSafeEqual` for comparing cryptographic signatures. Remember to compare buffer lengths first, as `timingSafeEqual` throws an error if lengths differ, which could cause an application crash or information leakage.

## 2026-06-04 - [Overly Permissive CORS Policy]
**Vulnerability:** The Express app previously configured CORS to allow all origins using `app.use(cors())`, exposing the API to cross-origin requests from any site.
**Learning:** Default configurations in middleware like `cors` often prioritize developer convenience over security, allowing all origins by default.
**Prevention:** Always configure `cors` middleware explicitly to only allow specific, trusted origins (e.g., using `process.env.FRONTEND_URL` with a secure default).

## 2026-06-05 - Fix Overly Permissive CORS Policy
**Vulnerability:** The application used a wildcard CORS policy (`app.use(cors())`), allowing any origin to access the API.
**Learning:** Wildcard CORS policies in production APIs expose the application to cross-origin attacks, allowing malicious sites to make authorized requests on behalf of users.
**Prevention:** Always explicitly define allowed origins in CORS configurations, typically restricting access to known frontend domains and providing an environment variable (e.g., `CORS_ORIGIN`) for flexibility.

## 2026-06-05 - Sensitive Data Logging (Already Resolved)
**Vulnerability:** Found an issue where sensitive API payload data could be logged via `console.log` in the QuickBooks integration (`QuickBooksClient.ts`), which would expose tenant and financial data.
**Learning:** Production code must not contain verbose debug logging, especially for external API integrations containing financial or authentication payloads.
**Prevention:** Utilize structured logging utilities with proper redaction capabilities for sensitive objects instead of generic `console.log`.

## 2026-06-05 - Hardcoded Fallback Secret for Shopify Webhook
**Vulnerability:** Found a hardcoded fallback secret ('dummy_secret') used for verifying Shopify webhooks if the environment variable was missing.
**Learning:** Hardcoding secrets or providing weak fallbacks undermines webhook signature verification, allowing attackers to forge webhook requests and manipulate inventory.
**Prevention:** Fail securely by explicitly checking for required security environment variables at startup and throwing an error if they are undefined, rather than providing fallback values.

## 2026-06-05 - Missing Global API Rate Limiting
**Vulnerability:** The application was missing a global rate limiter, allowing for potential DoS and brute-force attacks via unbounded API calls from single IPs.
**Learning:** Default Express applications do not come with any built-in rate limiting protections, making them vulnerable by default.
**Prevention:** Always implement a global rate limiter using libraries like `express-rate-limit`. Expose configuration to environment variables (e.g., `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`) to provide deployment flexibility and allow different environments to scale limits appropriately.

## 2026-06-06 - Secure Error Messages
**Vulnerability:** Controller catch blocks were returning the raw `error.message` directly to the client on 500 errors.
**Learning:** Passing internal error messages to the client on a 500 status code can unintentionally leak sensitive system details, internal paths, or unhandled states.
**Prevention:** Always return a generic error message (like 'Internal server error') for 500 status codes to prevent information disclosure, and ensure the actual error details are logged securely server-side.

## 2026-06-07 - Information Exposure in QuickBooks Client
**Vulnerability:** Sensitive business data (journal entry payloads) and integration URLs were being logged to the console.
**Learning:** Console logging of HTTP request payloads, especially those containing domain events or financial data, can inadvertently leak sensitive information to observability tools or local terminals.
**Prevention:** Avoid verbose console logging in production services. If logging is necessary, ensure structured logs are used and payloads are sanitized/omitted.

## 2026-06-07 - Fix Shopify Webhook Body Parsing for HMAC Validation
**Vulnerability:** The `ShopifyWebhookController` used `JSON.stringify(req.body)` to reconstruct the raw payload for HMAC signature validation.
**Learning:** Reconstructing the body from parsed JSON is flawed and alters the original buffer because JSON stringification may change ordering, spacing, or formatting from the original request. This can cause valid signatures to be rejected or obscure true forgery.
**Prevention:** Always use the raw, unparsed HTTP request buffer for cryptographic signature validation by hooking into middleware mechanisms (like the `verify` option in `express.json()`) to capture and store the raw payload before it is parsed.

## 2026-06-08 - Secure Error Handling
**Vulnerability:** API controllers leaking internal application state/exceptions to clients via generic error.message properties.
**Learning:** Catch-all blocks that return generic error objects can inadvertently leak sensitive stack traces or database info.
**Prevention:** Always check if an error is a safe domain exception before exposing its message, otherwise return a generic 500 error or static message.

## 2026-06-08 - Hallucinatory Sensitive Data Logged
**Vulnerability:** Hallucinated console.log with sensitive data in QuickBooksClient.ts.
**Learning:** Automated scanners or tasks might report vulnerabilities on code that has already been remediated or never existed.
**Prevention:** Always manually verify the file contents to confirm the vulnerability exists before attempting to patch it.

## 2026-06-08 - Code Reviewer Hallucination
**Vulnerability:** Code reviewer reported the fix was incomplete because it didn't remove console.log statements.
**Learning:** Code reviewers can hallucinate requirements based on the original task description, even when the requested code doesn't exist in the file.
**Prevention:** Always prioritize the actual codebase and git diff as the source of truth over reviewer feedback when discrepancies exist.

## 2026-06-10 - Insecure ID Generation
**Vulnerability:** Use of Math.random() to generate IDs (purchase orders, sales) in frontend.
**Learning:** Math.random() is cryptographically weak and predictable, potentially leading to ID collisions or predictability attacks in business logic.
**Prevention:** Always use a secure PRNG or a standard library like crypto.randomUUID() for generating unique identifiers.

## 2026-06-11 - Replace Insecure Math.random with crypto.randomUUID
**Vulnerability:** Several domain services, use cases, and repositories were using `Math.random().toString(36)` or `Date.now() + Math.random()` to generate unique identifiers for entities like SerializedItems, Audits, Purchase Orders, and RMAs.
**Learning:** `Math.random()` is not a cryptographically secure pseudo-random number generator (CSPRNG). Identifiers generated this way are predictable and susceptible to collision, especially in high-throughput environments.
**Prevention:** Always use Node's native `crypto.randomUUID()` (or a proven library like `uuid` v4) when generating unique, unpredictable identifiers to ensure system integrity and security.

## 2024-06-12 - Prevent Information Leakage in API Controllers
**Vulnerability:** API controllers returned raw error messages (`error.message`) in HTTP 500 and 400 responses unconditionally, leaking internal stack details or database states to end-users.
**Learning:** Exposing dynamic backend error messages directly in unhandled exception blocks is a medium/high severity risk. Only explicit domain exceptions (`DomainException`) are safe to expose to users, as their payloads are controlled.
**Prevention:** Standardize a pattern across API handlers. Never use `res.status(500).json({ error: error.message });`. Always fallback to generic descriptions (e.g. "Internal server error") or wrap the validation with a domain-specific error class.

## 2024-06-13 - Replace insecure Math.random() with crypto.randomInt() in MockCarrierService
**Vulnerability:** Used Math.random() to generate tracking number suffixes in MockCarrierService.
**Learning:** Math.random() is not a cryptographically secure pseudo-random number generator (CSPRNG), making identifiers generated this way predictable.
**Prevention:** Always use Node's native crypto utilities (like crypto.randomInt() or crypto.randomUUID()) when generating random identifiers to ensure unpredictability and security.

## 2026-06-12 - Prevent Injection and Malformed Input in InventoryController
**Vulnerability:** The `InventoryController` (for endpoints like receive, dispatch, performCount) lacked explicit input validation. This could allow malformed payloads (e.g., negative amounts, non-string SKUs) to trigger unhandled domain exceptions or database errors, which is a potential vector for DoS or unexpected internal states.
**Learning:** Trusting input directly from `req.body` without verification violates the principle of "Trust nothing, verify everything." Missing boundary checks on numbers can bypass domain logic if type coercion behaves unexpectedly.
**Prevention:** Always implement explicit input validation, type checking, and boundary assertions (like `amount <= 0` or `!Number.isInteger`) before invoking domain use cases.

## 2026-06-18 - Fix hardcoded JWT secret
**Vulnerability:** Hardcoded JWT secret fallback (`"super-secret-key"`) existed in `AuthController.ts` and `auth.ts` middleware.
**Learning:** Developers sometimes use a hardcoded fallback secret to prevent the application from crashing locally, but this risks unauthorized token signing if not explicitly set in production environments.
**Prevention:** Always enforce the presence of critical security environment variables on startup (e.g., throwing an error if missing) and provide dummy values explicitly for testing environments instead of relying on unsafe fallbacks.

## 2024-06-20 - Prevent Information Leakage in API Controllers
**Vulnerability:** API controllers returned raw error messages (`error.message`) in HTTP 500 responses unconditionally, leaking internal stack details or database states to end-users.
**Learning:** Exposing dynamic backend error messages directly in unhandled exception blocks is a medium/high severity risk. Only explicit domain exceptions (`DomainException`) are safe to expose to users, as their payloads are controlled.
**Prevention:** Standardize a pattern across API handlers. Never use `res.status(500).json({ error: error.message });`. Always fallback to generic descriptions (e.g. "Internal server error") or wrap the validation with a domain-specific error class.

## 2026-06-25 - Missing Strict Rate Limiting on Authentication Endpoint
**Vulnerability:** The application had a global rate limiter, but the login endpoint (`/api/auth/login`) lacked a strict, endpoint-specific rate limiter, making it susceptible to brute-force password guessing attacks.
**Learning:** Global rate limiters (e.g., 100 requests per 15 minutes) are often too permissive for sensitive endpoints like login, allowing attackers sufficient attempts to guess passwords or enumerate users.
**Prevention:** Always implement strict, configurable rate limiting (e.g., 5 attempts per 15 minutes) specifically on authentication and password reset endpoints to effectively mitigate brute-force and credential stuffing attacks.

## 2026-07-02 - [Fix HTTP Parameter Pollution]
**Vulnerability:** The application was not explicitly validating that `req.query` parameters were strings, potentially allowing HTTP Parameter Pollution (HPP) by passing arrays or objects, which could cause application crashes or bypass certain logic.
**Learning:** This is a medium priority vulnerability that could lead to unexpected behavior when `req.query` objects are passed directly to `prisma.$queryRaw` or similar methods.
**Prevention:** Always validate that `req.query` values are of the expected primitive type (`typeof parameter === "string"`) before processing them in controllers.

## 2026-07-06 - [Fix Information Disclosure in BarcodeController]
**Vulnerability:** The application was exposing `error.message` for `DomainException` instances directly in `res.status(404)` responses in `BarcodeController.ts`.
**Learning:** Even though `DomainException` signifies validated domain logic errors, exposing its dynamic message can leak internal state (like exact inventory numbers or specific failure reasons) to the client, constituting Information Disclosure.
**Prevention:** Always map domain exception details to a generic, static safe string (e.g., 'Not registered') in the HTTP response, while ensuring the original error details are securely logged server-side (`console.error`) for troubleshooting.

## 2024-07-09 - Information Disclosure in Webhook Subscription Controller
**Vulnerability:** The webhook subscription endpoints leaked raw backend error messages directly to the client in HTTP 500 responses.
**Learning:** Exposing raw backend exception details (error.message or error.stack) in HTTP error responses can leak sensitive business logic or internal states. This was specifically found in a controller handling secrets.
**Prevention:** Always map these errors to generic, static safe strings (e.g., 'Internal server error') instead of returning the dynamic error.message directly, and ensure original dynamic errors are logged server-side for troubleshooting.

## 2026-07-11 - [Fix Information Disclosure in ShippingController]
**Vulnerability:** The application was exposing `error.message` directly in `res.status(500)` responses in `ShippingController.ts` (specifically in `routeOrder`).
**Learning:** Exposing raw backend exception details in HTTP 500 responses can leak sensitive internal state to end-users, violating defense-in-depth principles. This specific instance was uncovered where a generic 500 error appended the raw message via `"Failed to route order: " + error.message`.
**Prevention:** Standardize a pattern across API handlers. Never use `res.status(500).json({ error: "..." + error.message });`. Always fallback to generic descriptions (e.g. "Failed to route order.") and rely on robust server-side logging for troubleshooting.

## 2024-05-24 - Timing Attack in Password Verification
**Vulnerability:** Comparing password hashes using standard string equality operator `===`.
**Learning:** This is vulnerable to timing attacks, as `===` compares characters sequentially and returns `false` on the first mismatch. Attackers can deduce the hash based on verification time.
**Prevention:** Always use `crypto.timingSafeEqual` after checking buffer lengths when comparing sensitive cryptographic data like passwords or HMACs to ensure constant-time comparison.

## 2026-07-10 - Stop Information Leakage in HTTP Error Responses
**Vulnerability:** HTTP 404 responses in `BarcodeController.ts` were explicitly returning the dynamic `error.message` from `DomainException` to the client when a scan failed (e.g., "Not registered").
**Learning:** Returning dynamic, backend-generated error messages directly in HTTP responses exposes internal application state and logic. This can aid attackers in mapping out the system or understanding business rules they shouldn't have access to.
**Prevention:** To prevent Information Disclosure, never expose raw backend error messages or stack traces directly to the client. Always log the dynamic error server-side using `console.error` (or a structured logger) for troubleshooting, and return a generic, static safe string (e.g., "Barcode not registered or invalid") in the JSON response payload.

## 2026-07-10 - Stop Information Leakage in HTTP Error Responses
**Vulnerability:** HTTP 404 responses in `BarcodeController.ts` were explicitly returning the dynamic `error.message` from `DomainException` to the client when a scan failed (e.g., "Not registered").
**Learning:** Returning dynamic, backend-generated error messages directly in HTTP responses exposes internal application state and logic. This can aid attackers in mapping out the system or understanding business rules they shouldn't have access to.
**Prevention:** To prevent Information Disclosure, never expose raw backend error messages or stack traces directly to the client. Always log the dynamic error server-side using `console.error` (or a structured logger) for troubleshooting, and return a generic, static safe string (e.g., "Barcode not registered or invalid") in the JSON response payload.
