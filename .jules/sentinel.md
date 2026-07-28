## 2024-05-31 - [Sentinel: Remove insecure default fallback for JWT_SECRET]
**Vulnerability:** The application used an empty string (`""`) as a default fallback for the `JWT_SECRET` environment variable in the Auth Middleware.
**Learning:** This insecure fallback bypassed the subsequent check designed to throw an error if the secret was missing. The fallback was likely added to satisfy the TypeScript compiler.
**Prevention:** Remove the insecure fallback and use TypeScript's type assertion (`as string`) to satisfy the compiler while preserving the required error-throwing behavior for missing secrets.
