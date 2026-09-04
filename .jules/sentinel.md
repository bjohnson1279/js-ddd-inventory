## 2024-05-31 - [Sentinel: Remove insecure default fallback for JWT_SECRET]
**Vulnerability:** The application used an empty string (`""`) as a default fallback for the `JWT_SECRET` environment variable in the Auth Middleware.
**Learning:** This insecure fallback bypassed the subsequent check designed to throw an error if the secret was missing. The fallback was likely added to satisfy the TypeScript compiler.
**Prevention:** Remove the insecure fallback and use TypeScript's type assertion (`as string`) to satisfy the compiler while preserving the required error-throwing behavior for missing secrets.

## 2026-07-29 - [SQL Injection Defense in Depth via pg-format]\n**Vulnerability:** Use of string interpolation inside Prisma's `$executeRawUnsafe` for DDL statements (e.g., `ALTER TABLE`).\n**Learning:** Prisma and PostgreSQL do not support parameterized identifiers (like table names) in DDL statements. While a regex check existed, using `$executeRawUnsafe` with string interpolation remains an anti-pattern. Code review automation may fail the PR if a new dependency (`pg-format`) is added without updating `package.json`, even if the dependency is already present in the `package.json` file.\n**Prevention:** Use `pg-format` with the `%I` specifier (e.g., `format('ALTER TABLE %I...', table)`) to securely escape identifiers. Ensure all required dependencies are fully recognized by the reviewer or already exist in the `package.json` before finalizing the PR.


## 2026-07-30 - [Express Parameter Type Confusion]
**Vulnerability:** The application extracted `tenantId` and `timestamp` from `req.query` in `ComplianceController.ts` using TypeScript type assertions (e.g., `req.query.tenantId as string`) without runtime verification.
**Learning:** TypeScript assertions do not exist at runtime. If an attacker provides an array or object in the query string (e.g., `?tenantId[]=foo`), it bypasses the type check. If this parameter is subsequently used in ORM queries, it can lead to NoSQL/ORM injection or filtering vulnerabilities.
**Prevention:** Always enforce runtime type safety using `typeof req.query.param === 'string' ? req.query.param : undefined` (or a default value) when extracting single string parameters from Express `req.query`.

## 2024-05-18 - Broken Access Control on App Routes
**Vulnerability:** Endpoints defined directly on the app instance (e.g., `app.get("/api/admin/cache/stats")`) were protected by `authMiddleware` but lacked role-based authorization checks, allowing any authenticated user to perform administrative actions.
**Learning:** Adding `authMiddleware` to secure routes ensures authentication but does not automatically enforce role-based access control (RBAC). For highly privileged endpoints, explicit RBAC must be applied even if they sit behind an auth guard.
**Prevention:** Always combine `authMiddleware` with a specific authorization middleware (like `requireRole(["admin"])`) for sensitive endpoints, especially when endpoints are registered individually instead of using an already-protected router.

## Prevention Directives for Automated Refactoring
- **Never Overwrite Complete Files**: Always use range-scoped replacement chunks (`StartLine`/`EndLine`) for edits to `schema.prisma`, `index.ts`, `public/index.php`, or DDL SQL scripts.
- **Do Not Remove Core Declarations**: Do not delete existing route registrations or Prisma model definitions.
- **Environment Isolation Compatibility**: When replacing fallback secrets, preserve test environment execution via `!getenv('APP_ENV')` or `getenv('APP_ENV') === 'testing'`.
- **No Scratch Files**: Never stage or commit `test_*.ts`, `test_*.js`, or `test.js` files to git.

## 2025-02-28 - Plaintext Webhook Secret Vulnerability
**Vulnerability:** Webhook subscription HMAC secrets were being stored in plaintext in the database.
**Learning:** Symmetric encryption at rest (like AES-256-GCM) is required instead of standard one-way hashing because the application needs the plaintext secret in memory to sign outgoing webhook payloads.
**Prevention:** Always implement an encryption utility at the domain/infrastructure layer for sensitive keys and tokens, and ensure both controllers and worker background tasks transparently encrypt/decrypt these values at the boundary.

## 2024-05-24 - SSRF IPv6 Bypass
**Vulnerability:** The SSRF protection in webhook delivery only checked IPv4 addresses properly. It was possible to bypass the protection using IPv6 addresses, including IPv4-mapped IPv6, IPv6 loopback, and Unique Local Addresses, because the logic solely relied on an IPv4 regex match and an exact string match for `::1`.
**Learning:** Using basic string matching or an IPv4 regex for network address filtering leaves the application vulnerable to IPv6-based bypasses. Relying on `require('net')` dynamically inside a TypeScript function is an anti-pattern that can cause runtime errors in ESM environments or linting failures.
**Prevention:** Use Node.js's native `net` module (imported at the top level) to differentiate between IPv4 and IPv6 addresses. For IPv6, implement robust parsing or blocklist checks that account for the unspecified address (`::`), IPv4-mapped IPv6 formats, and the correct CIDR ranges for Unique Local (`fc00::/7`) and Link-Local (`fe80::/10`) addresses, instead of naive prefix matching.
