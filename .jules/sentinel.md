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

