## 2026-06-04 - Fix Timing Attack in Webhook HMAC Validation
**Vulnerability:** The Shopify webhook signature validation in `ShopifyWebhookSecurity.ts` used a standard string equality operator (`hash === hmac`).
**Learning:** Using simple string comparison for cryptographic hashes enables timing attacks, where an attacker can theoretically infer the correct HMAC by observing response times, bypassing webhook authenticity checks.
**Prevention:** Always use `crypto.timingSafeEqual` for comparing cryptographic signatures. Remember to compare buffer lengths first, as `timingSafeEqual` throws an error if lengths differ, which could cause an application crash or information leakage.
## 2025-02-18 - Remove Sensitive Console Logging in QuickBooks Client
**Vulnerability:** Sensitive API payload and integration URLs were being logged to the console via `console.log`, potentially exposing financial data and internal architecture.
**Learning:** Using verbose console logs for API integrations can expose sensitive data in production environments, creating a security risk.
**Prevention:** Avoid verbose logging of API payloads or URLs. If logging is necessary, use a structured logging mechanism that appropriately redacts sensitive fields and ensure that debug-level logs are not active in production.
