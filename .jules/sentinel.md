## YYYY-MM-DD - [Add strict rate limiting to auth setup]
**Vulnerability:** The `/api/auth/setup` endpoint lacked specific rate limiting, making it vulnerable to automated brute-forcing or DoS attacks that could spam the database with new organizations and admin users.
**Learning:** Even if a global rate limiter is present, endpoints that create high-privilege resources (like admins or tenants) require dedicated, stricter rate limits (e.g. 10 requests per 15 minutes) to prevent abuse.
**Prevention:** Apply specific, configurable rate limiting middleware to all endpoints involved in authentication, user creation, or tenant bootstrapping.

## 2026-06-25 - TimescaleDB Setup and Database Parity Constraints
**Learning:** In multi-variant backends (GraphQL, Express, Laravel), switching database engines (e.g., reverting the Express backend to SQLite or using mock local SQLite files) breaks TimescaleDB hypertable features and causes database drift. Additionally, database connection configuration must be securely validated.
**Action:** 
- Maintain database engine parity across all service variants by strictly using PostgreSQL for physical datastores.
- Do not run `prisma db push` during automated npm package installation (`postinstall`) in CI or production build environments, as it will fail due to the absence of a running database. Limit postinstall steps to `prisma generate` and execute migrations/pushes in dedicated pipeline steps or deployment startup phases.
- Ensure that any dynamic database connection strings (like `DATABASE_URL` built from separate components) are validated on server startup and fallback safely to trusted local defaults for development environments.
- Protect raw SQL queries used to enable the `timescaledb` extension or initialize hypertables from SQL injection vulnerabilities by using parameterized queries or strict schema names.
