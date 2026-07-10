## 2026-06-26 - [Avoid Error Leakage]
**Vulnerability:** The application was exposing `error.message` for `DomainException` instances directly in `res.status(400)` responses across multiple controllers.
**Learning:** Even though `DomainException` signifies validated domain logic errors, exposing its dynamic message can leak internal state (like exact inventory numbers or specific failure reasons) to the client, constituting Information Disclosure.
**Prevention:** Always map domain exception details to a generic, static safe string (e.g., 'A domain error occurred') in the HTTP response, while ensuring the original error details are securely logged server-side (`console.error`) for troubleshooting.

## 2026-07-10 - Fix error handling exposing internal details in BarcodeController
**Vulnerability:** Raw backend error messages from DomainExceptions (error.message) were directly returned to the client in HTTP 404 responses.
**Learning:** Returning dynamic exception messages exposes potentially sensitive business logic or internal state details (like stock levels) to users.
**Prevention:** Always log dynamic errors server-side (console.error) and return a static, generic safe string ("Not registered") to the client.
