## 2025-02-14 - Fix Hardcoded Fallback Secret for Shopify Webhook
**Vulnerability:** A hardcoded fallback string ('dummy_secret') was used for `ShopifyWebhookSecurity` if the `SHOPIFY_API_SECRET` environment variable was not set.
**Learning:** Hardcoded secrets and fallback secrets in production code present a significant security vulnerability, enabling attackers to bypass authentication or cryptographic validation. In this case, malicious actors could easily forge webhooks by generating HMAC signatures with the well-known fallback secret.
**Prevention:** Never include fallback default strings for cryptographic keys or secrets. Rely exclusively on secure environment variables and implement "fail-fast" behavior: the application should explicitly throw an error or crash upon startup if essential security variables are missing, preventing it from running in an insecure state.
## 2026-06-04 - Fix Timing Attack in Webhook HMAC Validation
**Vulnerability:** The Shopify webhook signature validation in `ShopifyWebhookSecurity.ts` used a standard string equality operator (`hash === hmac`).
**Learning:** Using simple string comparison for cryptographic hashes enables timing attacks, where an attacker can theoretically infer the correct HMAC by observing response times, bypassing webhook authenticity checks.
**Prevention:** Always use `crypto.timingSafeEqual` for comparing cryptographic signatures. Remember to compare buffer lengths first, as `timingSafeEqual` throws an error if lengths differ, which could cause an application crash or information leakage.
## 2025-02-18 - Remove Sensitive Console Logging in QuickBooks Client
**Vulnerability:** Sensitive API payload and integration URLs were being logged to the console via `console.log`, potentially exposing financial data and internal architecture.
**Learning:** Using verbose console logs for API integrations can expose sensitive data in production environments, creating a security risk.
**Prevention:** Avoid verbose logging of API payloads or URLs. If logging is necessary, use a structured logging mechanism that appropriately redacts sensitive fields and ensure that debug-level logs are not active in production.
## 2026-06-05 - Hardcoded Fallback Secret for Shopify Webhook
**Vulnerability:** Found a hardcoded fallback secret ('dummy_secret') used for verifying Shopify webhooks if the environment variable was missing.
**Learning:** Hardcoding secrets or providing weak fallbacks undermines webhook signature verification, allowing attackers to forge webhook requests and manipulate inventory.
**Prevention:** Fail securely by explicitly checking for required security environment variables at startup and throwing an error if they are undefined, rather than providing fallback values.

## 2026-06-04 - Fix Overly Permissive CORS Policy
**Vulnerability:** The Express app was using `app.use(cors())`, allowing cross-origin requests from any domain by default, potentially exposing authenticated APIs or private data to malicious websites.
**Learning:** Using `cors()` without options defaults to `*` for origins. This is convenient for development but highly insecure for production as it bypasses the browser's Same-Origin Policy protections.
**Prevention:** Always explicitly define the `origin` option in CORS configurations, typically using an environment variable like `CORS_ORIGIN` for environment-specific flexibility while defaulting to `http://localhost:3000` for local development.
