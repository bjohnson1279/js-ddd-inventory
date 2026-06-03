## 2026-06-02 - Fixed Timing Attack Vulnerability in HMAC Validation
**Vulnerability:** The Shopify webhook signature validation (`src/infrastructure/shopify/ShopifyWebhookSecurity.ts`) used strict string equality (`===`) to compare HMAC hashes.
**Learning:** String equality operators exit early when characters mismatch, which exposes timing information. An attacker can use this timing side-channel to forge valid webhook signatures, bypassing security and allowing unauthorized operations.
**Prevention:** Always use constant-time comparison functions, like Node.js's `crypto.timingSafeEqual`, when comparing cryptographic hashes, signatures, or passwords to prevent timing attacks. When using `crypto.timingSafeEqual`, wrap it in a `try...catch` block since it throws an error if buffer lengths differ.

## 2026-06-03 - Removed Hardcoded Secret Fallback
**Vulnerability:** The Shopify webhook handler was falling back to a hardcoded secret (`'dummy_secret'`) if `SHOPIFY_API_SECRET` was missing.
**Learning:** Hardcoded default secrets are a critical vulnerability, as attackers discovering the default can forge requests. Applications must fail securely and crash at startup if critical security configurations are missing. Never rely on default values for secrets.
- Restricted CORS to process.env.FRONTEND_URL || 'http://localhost:3000' to prevent overly permissive cross-origin requests.
Logged removal of sensitive data (QuickBooks payload) from logs. Always check unit tests when modifying console.log statements as they might be spied on.
