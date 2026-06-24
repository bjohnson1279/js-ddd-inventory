## YYYY-MM-DD - [Add strict rate limiting to auth setup]
**Vulnerability:** The `/api/auth/setup` endpoint lacked specific rate limiting, making it vulnerable to automated brute-forcing or DoS attacks that could spam the database with new organizations and admin users.
**Learning:** Even if a global rate limiter is present, endpoints that create high-privilege resources (like admins or tenants) require dedicated, stricter rate limits (e.g. 10 requests per 15 minutes) to prevent abuse.
**Prevention:** Apply specific, configurable rate limiting middleware to all endpoints involved in authentication, user creation, or tenant bootstrapping.
