# js-ddd-inventory Copilot Instructions

This repository is a TypeScript-based inventory application built around Express.js, Prisma, and Domain-Driven Design (DDD).

## Important context

- Stack: `TypeScript`, `Express`, `Prisma`, `Node.js`
- Core application layers:
  - `src/domain/` for business logic
  - `src/application/` for use cases and ports
  - `src/infrastructure/` for database adapters and HTTP controllers
- Frontend app lives in `webapp/`
- API documentation is in `API.md`
- DDD design documentation is in `plan/`

## Key behaviors

- Uses REST API routes for inventory and catalog operations
- Supports Shopify synchronization and webhook-driven order processing
- Uses Prisma for database access and can run on PostgreSQL / TimescaleDB
- Backend development command is `npm run dev`

## Common repo tasks

### Install and setup
```bash
cd js-ddd-inventory
npm install
```

### Run backend
```bash
npm run dev
```

### Run tests
```bash
npm test
```

### Build for production
```bash
npm run build
```

## Guidance for Copilot edits

- Keep domain logic separate from HTTP adapters.
- If adding new API endpoints, update `API.md` and include route documentation.
- If editing Prisma entities or schema, verify the database adapter and migrations.
- Avoid mixing frontend and backend code; `webapp/` should be changed only for UI concerns.
