# Retail Inventory System (DDD)

An Express.js API for a retail inventory system built using Domain-Driven Design (DDD) principles. This project handles complex inventory scenarios including multi-unit conversions, structured initial stock onboarding, and two-way Shopify synchronization.

## Features

- **DDD Architecture**: Clear separation between Domain, Application, and Infrastructure layers.
- **Unit of Measure (UOM)**: Support for Discrete (cases, each), Weight (kg, g), and Volume (l, ml) conversions.
- **Opening Balance**: Structured onboarding process for initial stock counts with conflict detection.
- **Shopify Integration**: Two-way sync using GraphQL Admin API and Webhooks for order stock deductions.
- **Unit Testing**: Comprehensive test suite using Jest.

## Prerequisites

- Node.js (v18+)
- npm

## Setup Instructions

### Standard Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/bjohnson1279/js-ddd-inventory.git
   cd js-ddd-inventory
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Run the application (In-Memory)**:
   ```bash
   npm run dev
   ```

### Docker Setup (with PostgreSQL)

The easiest way to run the application with a persistent database and the setup web app is using Docker Compose.

1. **Run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

This will start:
- A PostgreSQL 16 database container.
- The inventory application container (API) on port `5000`.
- The **Inventory Setup Web App** on port `3080`.

### Initial Inventory Setup

Once the containers are running, navigate to `http://localhost:3080` to access the setup web app. This tool allows you to initialize your inventory with your first stock counts across any SKU and location.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | The port the server listens on | `5000` |
| `DB_HOST` | PostgreSQL host (set this to enable Postgres) | - |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `password` |
| `DB_NAME` | PostgreSQL database name | `inventory` |
| `SHOPIFY_API_SECRET` | Shopify App API Secret | - |
| `SHOPIFY_SHOP_URL` | Shopify Shop URL | - |
| `SHOPIFY_ACCESS_TOKEN` | Shopify Admin Access Token | - |
| `QUICKBOOKS_REALM_ID` | QuickBooks Company ID | - |
| `QUICKBOOKS_ACCESS_TOKEN` | QuickBooks API Access Token | - |
| `QUICKBOOKS_ENVIRONMENT` | Set to 'production' for live sync | `sandbox` |

## Project Structure

- `src/domain`: Core business logic (Aggregates, Value Objects, Entities, Services).
- `src/application`: Use cases and ports (interfaces for infrastructure).
- `src/infrastructure`: External implementations (Database, Shopify Client, HTTP Controllers/Routes).
- `tests`: Unit tests for domain and application layers.

## Documentation

- [API Documentation](API.md): Detailed usage of all API endpoints.
- [Design Plans](plan/): Detailed DDD design documents for various features.
