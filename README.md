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

1. **Clone the repository**:
   ```bash
   git clone https://github.com/bjohnson1279/js-ddd-inventory.git
   cd js-ddd-inventory
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   Create a `.env` file in the root directory (optional, but required for full Shopify integration):
   ```env
   PORT=5000
   SHOPIFY_API_SECRET=your_api_secret
   SHOPIFY_SHOP_URL=your-shop.myshopify.com
   SHOPIFY_ACCESS_TOKEN=your_access_token
   ```

4. **Build the project**:
   ```bash
   npm run build
   ```

5. **Run the application**:
   - Development mode: `npm run dev`
   - Production mode: `npm run start`

6. **Run tests**:
   ```bash
   node node_modules/jest/bin/jest.js
   ```

## Project Structure

- `src/domain`: Core business logic (Aggregates, Value Objects, Entities, Services).
- `src/application`: Use cases and ports (interfaces for infrastructure).
- `src/infrastructure`: External implementations (Database, Shopify Client, HTTP Controllers/Routes).
- `tests`: Unit tests for domain and application layers.

## Documentation

- [API Documentation](API.md): Detailed usage of all API endpoints.
- [Design Plans](plan/): Detailed DDD design documents for various features.
