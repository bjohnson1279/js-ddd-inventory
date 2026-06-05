## 2026-06-04 - Fix Timing Attack in Webhook HMAC Validation
**Vulnerability:** The Shopify webhook signature validation in `ShopifyWebhookSecurity.ts` used a standard string equality operator (`hash === hmac`).
**Learning:** Using simple string comparison for cryptographic hashes enables timing attacks, where an attacker can theoretically infer the correct HMAC by observing response times, bypassing webhook authenticity checks.
**Prevention:** Always use `crypto.timingSafeEqual` for comparing cryptographic signatures. Remember to compare buffer lengths first, as `timingSafeEqual` throws an error if lengths differ, which could cause an application crash or information leakage.
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
