# Domain Architecture & Layer Isolation Guidelines

## Layer Boundaries
1. **Domain Layer (`src/domain/`)**: Contains aggregate roots, entities, value objects, domain events, and domain service interfaces. MUST NOT import database ORMs (Prisma), Express controllers, or HTTP frameworks directly.
2. **Application Layer (`src/application/`)**: Use cases, command/query handlers, and transaction orchestration. Mediates between API endpoints and Domain Services.
3. **Infrastructure Layer (`src/infrastructure/`)**: Database adapters (Prisma repositories), external ERP connectors, and security encryption utilities.
4. **Presentation / API Layer (`src/controllers/`, `src/routes/`)**: Handles Express HTTP requests, route parameters, and response formatting.

## Automated Refactoring Rules
- **Maintain Single-Responsibility**: Do not embed ORM transactions directly inside Presentation controllers.
- **Range-Scoped Patching**: Always use range-scoped replacement chunks (`StartLine`/`EndLine`) for edits to maintain readable git diffs.
- **Test-Pairing Mandatory Directive**: Every PR modifying domain logic or security handlers MUST include a corresponding unit or integration test update.
