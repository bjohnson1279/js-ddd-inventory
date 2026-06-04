## 2026-06-04 - Fix Timing Attack in Webhook HMAC Validation
**Vulnerability:** The Shopify webhook signature validation in `ShopifyWebhookSecurity.ts` used a standard string equality operator (`hash === hmac`).
**Learning:** Using simple string comparison for cryptographic hashes enables timing attacks, where an attacker can theoretically infer the correct HMAC by observing response times, bypassing webhook authenticity checks.
**Prevention:** Always use `crypto.timingSafeEqual` for comparing cryptographic signatures. Remember to compare buffer lengths first, as `timingSafeEqual` throws an error if lengths differ, which could cause an application crash or information leakage.

## 2026-06-04 - [Overly Permissive CORS Policy]
**Vulnerability:** The Express app previously configured CORS to allow all origins using `app.use(cors())`, exposing the API to cross-origin requests from any site.
**Learning:** Default configurations in middleware like `cors` often prioritize developer convenience over security, allowing all origins by default.
**Prevention:** Always configure `cors` middleware explicitly to only allow specific, trusted origins (e.g., using `process.env.FRONTEND_URL` with a secure default).
