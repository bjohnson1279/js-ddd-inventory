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

## 2024-05-24 - SSRF IPv6 Hex Bypass
**Vulnerability:** The SSRF protection in webhook delivery only checked IPv4 addresses and standard string representations for IPv6 loopbacks. It was possible to bypass the protection using hex-encoded IPv4-mapped IPv6 addresses (e.g. `::ffff:7f00:1` or `0:0:0:0:0:ffff:7f00:1`).
**Learning:** Using basic regex matching for IPv4-mapped IPv6 addresses fails if the embedded IPv4 part is hex encoded instead of standard decimal formatting.
**Prevention:** Always implement robust parsing for the embedded IPv4 payload inside an IPv6 mapping block (e.g. parsing `7f00:1` using bitwise shifts) to ensure standard IPv4 blocklists evaluate accurately against all string representations.

## Prevention Directives for Automated Refactoring
- **Never Overwrite Complete Files**: Always use range-scoped replacement chunks (`StartLine`/`EndLine`) for edits to `schema.prisma`, `index.ts`, `public/index.php`, or DDL SQL scripts.
- **Do Not Remove Core Declarations**: Do not delete existing route registrations or database DDL tables.
- **Environment Isolation Compatibility**: When replacing fallback secrets, preserve test environment execution via `!getenv('APP_ENV')` or `getenv('APP_ENV') === 'testing'`.
- **No Scratch Files**: Never stage or commit `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `test.js` files to git.
- **No Unresolved Conflict Markers**: Never stage or commit files containing Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`). Always resolve conflicts cleanly before committing.

## Hallucinatory Task & Empty PR Directives
- **Zero-Diff Task Termination**: If the requested optimization, refactor, or fix is ALREADY natively present in the target branch, DO NOT create an empty pull request or commit an acknowledgment PR. Exit the task cleanly without opening a PR.
- **Stale Suggestion Guard**: Always verify the current code on `main`/`master` before planning changes. If no actionable diff is required, cancel task execution immediately.

## 2024-05-15 - Multi-IP SSRF DNS Bypass
**Vulnerability:** The SSRF mitigation `isSafeUrl` was only verifying the first IP address returned by `dns.lookup`, allowing attackers to register a domain with multiple A/AAAA records (a public IP followed by an internal IP) to bypass validation and access internal services.
**Learning:** Checking only the first result of `dns.lookup` is insufficient for SSRF protection because it ignores potentially malicious secondary records that HTTP clients (like fetch) might fallback to, or round-robin DNS configurations.
**Prevention:** Always use `dns.lookup(hostname, { all: true })` (or `dns.resolve`) and validate every single IP address in the returned array to ensure no internal addresses can be reached.

## 2024-05-31 - [Sentinel: Remove insecure default fallback for JWT_SECRET]
**Vulnerability:** The application used an empty string (`""`) as a default fallback for the `JWT_SECRET` environment variable in the Auth Controller.
**Learning:** This insecure fallback bypassed the subsequent check designed to throw an error if the secret was missing. The fallback was likely added to satisfy the TypeScript compiler.
**Prevention:** Remove the insecure fallback and use TypeScript's type assertion (`as string`) to satisfy the compiler while preserving the required error-throwing behavior for missing secrets.

## Prevention Directives for Automated Refactoring
- **Never Overwrite Complete Files**: Always use range-scoped replacement chunks for edits to `schema.prisma`, `index.ts`, `public/index.php`, `db/schema.rb`, or DDL SQL scripts.
- **Do Not Remove Core Declarations**: Do not delete existing route registrations or database DDL tables.
- **Environment Isolation Compatibility**: When replacing fallback secrets, preserve test environment execution via `!getenv('APP_ENV')` or `getenv('APP_ENV') === 'testing'`.
- **No Scratch Files**: Never stage or commit `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `test.js` files to git.
- **No Unresolved Conflict Markers**: Never stage or commit files containing Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`). Always resolve conflicts cleanly before committing.

## Completeness & Verification Directives
- **Explicit Parameter & Contract Validation**: When creating or modifying API endpoints (Express, Fastify, Rails, Laravel), always implement explicit parameter and request body validation schemas (e.g. `z.string().uuid()`) to prevent unhandled 404/500 fallthroughs.
- **Database Indexing for Queries**: When addressing query bottlenecks or adding query lookup filters, always implement native database index migrations rather than loading collections into memory and performing array filtering (`.filter()`, `.select`).
- **Co-Occurring Dependency Auditing**: When bumping any dependency version, verify that other transitive dependencies do not carry high/critical security advisories (e.g. run `bundler-audit`, `npm audit`). Never introduce a version bump that breaks underlying framework APIs.
- **Self-Verification Before Commit**: Always run syntax checks (`bash -n` for shell scripts, `tsc --noEmit` for TypeScript, linter checks) and targeted test runners locally before opening or updating a PR.

## Hallucinatory Task & Empty PR Directives
- **Zero-Diff Task Termination**: If the requested optimization, refactor, or fix is ALREADY natively present in the target branch, DO NOT create an empty pull request or commit an acknowledgment PR. Exit the task cleanly without opening a PR.
- **Stale Suggestion Guard**: Always verify the current code on `main`/`master` before planning changes. If no actionable diff is required, cancel task execution immediately.
## 2024-05-24 - Hardcoded JWT Secret Fallback
**Vulnerability:** The `AuthService` class defaulted to a hardcoded string `'production-jwt-secret-change-me'` when generating and verifying JSON Web Tokens (JWTs) if the `JWT_SECRET` environment variable was not set.
**Learning:** The fallback was likely added to prevent application crashes during local development, but in production environments, it allowed attackers to forge valid JWTs using the known key.
**Prevention:** Remove fallback secrets in production code and use strict assertions (like `as string` in TS) coupled with explicit runtime checks (`if (!JWT_SECRET) throw new Error(...)`) to guarantee secure key material is loaded before initializing cryptographic components.
## 2024-05-24 - Scratch File Deletion Rejection
**Vulnerability:** Automated CI guardrails actively monitor for and reject PRs that delete or modify scratch validation files (`test_auth.ts`).
**Learning:** Even though `test_auth.ts` was an ad-hoc scratchpad file, deleting it triggered a CI guardrail failure because it matches the `test_*.ts` pattern and its deletion is seen as a destructive test removal rather than workspace cleanup.
**Prevention:** Do not delete pre-existing files like `test_auth.ts` or `test_local.js` that were already committed to the repository, even if they appear to be temporary scratchpads.
## 2024-05-24 - Prisma Schema Breakages Causing CI Test Suite Failures
**Vulnerability:** Although fixing a security vulnerability is paramount, deploying a PR that leaves the CI testing suite completely broken (because of unrelated repository syntax errors) prevents automated code review validation and blocks the deploy pipeline. In this case, `prisma/schema.prisma` contained severe syntax errors causing `npm ci` and `prisma generate` to fail entirely, masking the security fix.
**Learning:** You must not submit a PR with a broken local execution environment unless that environment's issues are completely unresolvable. Even if out-of-scope for the primary objective, critical compilation syntax errors in configuration files (like Prisma schema) must be fixed before submitting to ensure the CI test suite can execute correctly.
**Prevention:** Always verify `npm install` and `npm run build`/`npx prisma generate` execute successfully. If they fail due to external syntax errors on `main`, include the syntax fixes in the PR so that the CI pipeline can evaluate the actual logic changes.
