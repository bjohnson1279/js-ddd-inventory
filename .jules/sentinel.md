## YYYY-MM-DD - Hardcoded Encryption Keys
**Vulnerability:** The application used hardcoded fallback encryption keys (`'fallback_secret_key'` and `'default_dev_key_change_in_prod'`) in `encryption.ts` and `security.ts` if the `ENCRYPTION_KEY` environment variable was missing.
**Learning:** Hardcoded fallback secrets are critical vulnerabilities because they silently mask missing configuration in production, resulting in sensitive data being encrypted with weak, known keys. Furthermore, replacing these fallbacks required caching the `crypto.scryptSync` result to avoid a critical performance regression.
**Prevention:** Always fail securely by explicitly throwing an error if a required cryptographic key is missing from the environment. Cache the results of expensive Key Derivation Functions (KDFs).
## 2024-05-18 - [Fix Timing Attack in Password Verification]
**Vulnerability:** The password verification function used a strict equality operator (`===`) to compare the computed PBKDF2 hash against the stored hash. This opened a potential timing side-channel attack where an attacker could theoretically infer the hash byte-by-byte.
**Learning:** `crypto.timingSafeEqual` should be used for comparing sensitive tokens and hashes to prevent timing attacks. However, it requires inputs of the same length, otherwise it throws an error and causes a Denial of Service (DoS) risk.
**Prevention:** Use a length check `if (hash.length !== verifyHash.length) return false;` before using `crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash))`.
## 2026-08-21 - DNS Rebinding SSRF Protection
**Vulnerability:** The webhook delivery worker checked if a URL's host resolved to a private IP, but then used the global `fetch` with the original URL, which resolves the IP again. An attacker could exploit DNS rebinding to return a safe IP during the check and a private IP during the fetch, bypassing SSRF protection.
**Learning:** Checking a hostname's IP and then requesting the hostname does not prevent SSRF if the DNS record has a short TTL (DNS Rebinding).
**Prevention:** Pin the validated IP using a custom dispatcher (e.g., `undici.Agent`) that forces the HTTP request to use the exact IP that was validated.
