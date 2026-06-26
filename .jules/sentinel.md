## 2026-06-26 - [Avoid Error Leakage]
**Vulnerability:** The application was exposing `error.message` for `DomainException` instances directly in `res.status(400)` responses across multiple controllers.
**Learning:** Even though `DomainException` signifies validated domain logic errors, exposing its dynamic message can leak internal state (like exact inventory numbers or specific failure reasons) to the client, constituting Information Disclosure.
**Prevention:** Always map domain exception details to a generic, static safe string (e.g., 'A domain error occurred') in the HTTP response, while ensuring the original error details are securely logged server-side (`console.error`) for troubleshooting.
