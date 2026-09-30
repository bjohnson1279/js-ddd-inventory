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

## 2026-09-14 - Fix Hardcoded JWT Secret Fallback in AuthService
**Vulnerability:** `AuthService.ts` used a hardcoded fallback string `'production-jwt-secret-change-me'` when `process.env.JWT_SECRET` was absent.
**Learning:** Hardcoded production secret fallbacks allow unauthenticated token forging if environment configuration is omitted. When enforcing mandatory secret variables, allow a fallback only in test mode (`process.env.NODE_ENV === 'test'`) to prevent breaking CI/test runners while strictly failing in production.
**Prevention:** Guard secret loading with `process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret' : undefined)` and throw an explicit error if missing.
## 2024-05-18 - Fix Critical JWT Verification API Misuse
**Vulnerability:** A critical authentication bypass where `jwt.verify` was incorrectly invoked with a stubbed function `() => true` in the `options` argument position, followed by the intended options object in the `callback` position.
**Learning:** `jsonwebtoken`'s `verify` signature allows the third argument to be either `options` or `callback`. If a function is passed as the third argument, it aggressively assumes it's a callback modifier, which completely misaligns subsequent arguments (causing the actual options to be executed as a callback). This resulted in an unhandled `TypeError: done is not a function`, crashing the service on authentication attempts, and fundamentally breaking signature and issuer validations.
**Prevention:** Strictly type-check the arguments passed to loosely-typed Node.js crypto/auth libraries. Never pass functions as optional arguments to overloaded library methods unless explicitly matching the documented asynchronous callback signature.

## 2024-05-18 - Insecure ID Generation
**Vulnerability:** Weak random number generation using `Math.random()` to generate entity IDs.
**Learning:** `Math.random()` is not cryptographically secure, and generated IDs are predictable and prone to collisions, which can lead to insecurity in multi-tenant environments.
**Prevention:** Always use cryptographically secure random number generators like `crypto.randomUUID()` for unique identifiers.
## 2025-02-24 - Fix Insecure Decryption Fallback in Security Utils
**Vulnerability:** The `decryptSymmetric` function inside `src/infrastructure/utils/security.ts` contained an insecure fallback mechanism where it returned the raw `ciphertext` as plaintext if decryption failed (e.g. invalid key, corrupted data).
**Learning:** Returning un-decrypted sensitive data (like database passwords in `TenantRegistry.ts`) on error is a critical security vulnerability that can leak ciphertext. If a key is rotated, the application may unintentionally process or expose raw ciphertext as plaintext.
**Prevention:** Always fail securely by throwing an error (`throw new Error('Decryption failed');`) instead of returning raw un-decrypted payload.

## Assertiveness, Decisive PR Execution & Comparative Recommendations
- **Proactive & Decisive PR Submission**: Do NOT repeatedly pause to ask permission to open a pull request (e.g., avoid "Would you like me to open a PR for this?", "Can I submit the PR?", "Should I go ahead and create the PR?"). When an optimization, fix, or feature satisfies requirements, passes local test runners/linters, and preserves architectural invariants, proceed decisively to create and submit the Pull Request with a clear, structured summary and rationale.
- **Explicit Recommendations on Options**: When presenting multiple implementation strategies or architecture options (e.g., Option A vs. Option B), NEVER leave the choice open-ended or passive. Always make an explicit, reasoned recommendation (prefixed with `(Recommended)`) based on **overall technical effectiveness**:
  1. *Algorithmic & Complexity Gains*: Time and space complexity impact (O(N*M) -> O(N+M), reduction of nested scans).
  2. *Resource Overhead*: Heap allocations, memory pressure, and GC pause reduction.
  3. *Domain & Architecture Invariants*: Strict backward compatibility, contract stability, and prevention of regression risks.
  4. *Security & Reliability*: Input validation, cryptographic safety, and concurrency safety.
- **Lead with Recommended Path**: State clearly why the recommended solution delivers the highest net value and immediately execute or propose it as the primary course of action rather than asking open-ended questions.

## Scope Verification, Minimal Churn & CI Protection Directives
- **Scope Verification Before Variable Binding**: When adding interactive states or accessibility attributes (e.g. `disabled={loading}`, `aria-busy={loading}`, `isSubmitting`), NEVER assume a variable identifier exists. Always inspect component props, local state hooks (`useState`), or declaration scope first. If not defined, declare the state hook or reuse an existing scope variable. Never introduce TS2304 / TS2552 ("Cannot find name") compile errors.
- **Surgical Edits Only (No Whole-File Formatting)**: Never run whole-file code formatters (Prettier, Black, Pint, rustfmt) across unmodified lines. Changes must be strictly range-scoped and limited to the minimal AST block needed. Avoid noisy quote/whitespace churn that masks real logic changes and causes merge conflicts. Verify with `git diff -w` that non-functional churn is zero.
- **Zero Scratch File Commits**: Never stage or commit ad-hoc verification, patch, or debug scripts (`test.cjs`, `fix_*.cjs`, `fix_*.php`, `patch_*.py`, `patch_*.sh`, `scratch_*`). Execute checks via the project's native test commands (`npm test`, `pytest`, `phpunit`, etc.) and delete temporary scripts before creating git commits.
- **Never Weaken CI Workflows**: Do not modify `.github/workflows/**` to bypass failures (e.g. adding `|| true`, setting `continue-on-error: true`, or commenting out assertions). Always resolve the defect in the source code or test fixture.
- **Explicit Parameter & Variable Types**: In TypeScript files, avoid implicit `any` by always providing explicit types on functions, parameters, and arrow callbacks (e.g. `(id: string) => ...`). Verify zero type errors with `tsc --noEmit` before committing.

## 2026-09-29 - Non-Destructive Security Patching & CI Protection
**Learning:** Security patches must never weaken CI workflow files (`.github/workflows/**`) by appending `|| true` or `continue-on-error: true` to suppress test/build failures. Furthermore, when adding defensive type assertions or input validators in TypeScript, omitting explicit types can introduce `TS7006: Parameter implicitly has an 'any' type`.
**Action:** Never modify CI workflow definitions to bypass test failures; resolve the underlying issue in source code or test fixtures. Always provide explicit types on newly introduced parameters and helper functions. Ensure zero scratch scripts (`fix_*.php`, `test_*.js`) are committed.

## Additive Documentation & Scratch Cleanliness Directives
- **Strictly Additive Journal Updates**: When updating `.jules/*.md`, strictly append new dated entries (`## YYYY-MM-DD - Title`). NEVER delete, truncate, or overwrite historical learnings or previous entries.
- **Substantive Code Diff Requirement**: Pull requests must include substantive code changes in `src/`, `app/`, `lib/`, or `tests/`. Never open PRs that modify only `.jules/*.md` journals or root scratch scripts.
- **Zero Scratch File Commits**: Never commit `*.diff`, `*.patch`, `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `patch_*.py` files. Always remove temporary debugging or verification scripts prior to committing.
