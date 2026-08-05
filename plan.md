1. Remove hardcoded fallback keys from `src/infrastructure/utils/encryption.ts` and `src/infrastructure/utils/security.ts`.
2. Throw an error if the ENCRYPTION_KEY environment variable is not defined, instead of falling back to a hardcoded string.
3. Complete pre commit steps to make sure proper testing, verifications, reviews and reflections are done.
4. Submit the fix.
