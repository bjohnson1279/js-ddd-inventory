## 2025-02-14 - Fix Hardcoded Fallback Secret for Shopify Webhook

**Vulnerability:** A hardcoded fallback string ('dummy_secret') was used for `ShopifyWebhookSecurity` if the `SHOPIFY_API_SECRET` environment variable was not set.
**Learning:** Hardcoded secrets and fallback secrets in production code present a significant security vulnerability, enabling attackers to bypass authentication or cryptographic validation. In this case, malicious actors could easily forge webhooks by generating HMAC signatures with the well-known fallback secret.
**Prevention:** Never include fallback default strings for cryptographic keys or secrets. Rely exclusively on secure environment variables and implement "fail-fast" behavior: the application should explicitly throw an error or crash upon startup if essential security variables are missing, preventing it from running in an insecure state.

## 2026-06-04 - Fix Timing Attack in Webhook HMAC Validation

**Vulnerability:** The Shopify webhook signature validation in `ShopifyWebhookSecurity.ts` used a standard string equality operator (`hash === hmac`).
**Learning:** Using simple string comparison for cryptographic hashes enables timing attacks, where an attacker can theoretically infer the correct HMAC by observing response times, bypassing webhook authenticity checks.
**Prevention:** Always use `crypto.timingSafeEqual` for comparing cryptographic signatures. Remember to compare buffer lengths first, as `timingSafeEqual` throws an error if lengths differ, which could cause an application crash or information leakage.

## 2026-06-04 - [Overly Permissive CORS Policy]

**Vulnerability:** The Express app previously configured CORS to allow all origins using `app.use(cors())`, exposing the API to cross-origin requests from any site.
**Learning:** Default configurations in middleware like `cors` often prioritize developer convenience over security, allowing all origins by default.
**Prevention:** Always configure `cors` middleware explicitly to only allow specific, trusted origins (e.g., using `process.env.FRONTEND_URL` with a secure default).

## 2025-02-18 - Remove Sensitive Console Logging in QuickBooks Client

**Vulnerability:** Sensitive API payload and integration URLs were being logged to the console via `console.log`, potentially exposing financial data and internal architecture.
**Learning:** Using verbose console logs for API integrations can expose sensitive data in production environments, creating a security risk.
**Prevention:** Avoid verbose logging of API payloads or URLs. If logging is necessary, use a structured logging mechanism that appropriately redacts sensitive fields and ensure that debug-level logs are not active in production.

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
