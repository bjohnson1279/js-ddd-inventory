# Retail Inventory System (DDD) — REST API Documentation

This document describes the complete set of HTTP endpoints available in the Node.js / Fastify inventory application, organized by bounded context.

---

## 🔐 Authentication & Users

### 1. Register / Organization Setup
Initialize organization details and register the root admin user.

*   **URL**: `/api/auth/setup`
*   **Method**: `POST`
*   **Headers**: `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `orgName` (string, Required): The organization name.
        *   `tenantId` (string, Required): Unique tenant identifier.
        *   `adminName` (string, Required): Name of the administrative user.
        *   `adminEmail` (string, Required): Valid email address for administrative logins.
        *   `adminPassword` (string, Required): Strong password for the admin account.
*   **Request Body**:
    ```json
    {
      "orgName": "My Warehouse Org",
      "tenantId": "tenant-1",
      "adminName": "John Doe",
      "adminEmail": "admin@example.com",
      "adminPassword": "password123"
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    { "success": true, "message": "Organization and admin user created successfully." }
    ```
*   **Workflow**: Run during initial onboarding to bootstrap a new tenant workspace and root admin user.

---

### 2. User Login
Authenticate credentials to receive a signed JSON Web Token (JWT).

*   **URL**: `/api/auth/login`
*   **Method**: `POST`
*   **Headers**: `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `tenantId` (string, Required): The tenant ID to authenticate against.
        *   `email` (string, Required): User email address.
        *   `password` (string, Required): Plaintext user password.
*   **Request Body**:
    ```json
    {
      "tenantId": "tenant-1",
      "email": "admin@example.com",
      "password": "password123"
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    { "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
    ```
*   **Workflow**: Clients submit credentials to retrieve a 24-hour JWT token with embedded tenant and role permissions for subsequent authenticated calls.

---

### 3. List Users
Retrieve all registered users within the caller's tenant.

*   **URL**: `/api/users`
*   **Method**: `GET`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Role required: `admin`)
*   **Parameters**: None
*   **Success Response**: `200 OK`
    ```json
    {
      "users": [
        {
          "id": "usr_123",
          "email": "admin@example.com",
          "name": "John Doe",
          "role": "admin",
          "active": true
        }
      ]
    }
    ```
*   **Workflow**: Tenant administrators list active members and roles in user management dashboards.

---

### 4. Invite User
Invite a new member to the organization with a designated role.

*   **URL**: `/api/users`
*   **Method**: `POST`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Role required: `admin`)
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `email` (string, Required): Email address for the invited user.
        *   `role` (string, Required): Assigned role ID (e.g., `admin`, `warehouse_operator`, `accountant`).
*   **Request Body**:
    ```json
    {
      "email": "staff@example.com",
      "role": "warehouse_operator"
    }
    ```
*   **Success Response**: `201 Created`
    ```json
    {
      "message": "User invited successfully.",
      "userId": "usr_987"
    }
    ```
*   **Workflow**: Generates a temporary password, provisions the user profile, and dispatches an invitation email if an email service is configured.

---

### 5. Update User Role
Modify an existing user's role and associated permissions.

*   **URL**: `/api/users/:userId/role`
*   **Method**: `PATCH`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Role required: `admin`)
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Path**:
        *   `userId` (string, Required): Identifier of the target user.
    *   **Body**:
        *   `role` (string, Required): New role identifier to assign.
*   **Request Body**:
    ```json
    {
      "role": "accountant"
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    { "success": true }
    ```
*   **Workflow**: Admin operators reassign access levels and permissions for existing organizational users.

---

## 📦 Inventory Management

### 1. List Inventory Items
Query current stock quantities across all inventory items.

*   **URL**: `/api/inventory`
*   **Method**: `GET`
*   **Headers**: `Authorization: Bearer <token>` (Optional)
*   **Parameters**: None
*   **Success Response**: `200 OK`
    ```json
    [
      {
        "id": "inv_1",
        "sku": "IPHONE-15-PRO-BLK",
        "locationId": "LOC-A1",
        "quantity": 50,
        "allocatedQuantity": 2,
        "inTransitQuantity": 0
      }
    ]
    ```
*   **Workflow**: Inspect real-time stock balances across warehouse bins and locations.

---

### 2. Receive Stock
Record inbound purchase order receipts or warehouse transfers into inventory.

*   **URL**: `/api/inventory/receive`
*   **Method**: `POST`
*   **Headers**: `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `sku` (string, Required): Product SKU.
        *   `amount` (number, Required): Positive integer quantity received.
        *   `locationId` (string, Optional): Destination warehouse bin/location.
        *   `unitCostCents` (number, Optional): Cost per unit in cents.
        *   `lotNumber` (string, Optional): Associated lot or batch number.
        *   `expirationDate` (string, Optional): ISO-8601 formatted expiration date.
        *   `tenantId` (string, Optional): Tenant identifier.
        *   `purchaseOrderId` (string, Optional): Originating purchase order ID.
*   **Request Body**:
    ```json
    {
      "sku": "IPHONE-15-PRO-BLK",
      "amount": 50,
      "locationId": "LOC-A1",
      "unitCostCents": 99900,
      "lotNumber": "LOT-2026-001"
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    { "message": "Stock received successfully" }
    ```
*   **Workflow**: Invoked when receiving physical stock at warehouse loading docks, updating on-hand levels and tracking lot details.

---

### 3. Dispatch Stock
Deduct on-hand physical stock for outbound orders or direct issues.

*   **URL**: `/api/inventory/dispatch`
*   **Method**: `POST`
*   **Headers**: `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `sku` (string, Required): Product SKU.
        *   `amount` (number, Required): Positive integer quantity to dispatch.
        *   `locationId` (string, Optional): Source location identifier.
*   **Request Body**:
    ```json
    {
      "sku": "IPHONE-15-PRO-BLK",
      "amount": 5,
      "locationId": "LOC-A1"
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    { "message": "Stock dispatched successfully" }
    ```
*   **Workflow**: Executes outbound stock depletion from warehouse locations upon order picking and packing.

---

### 4. Allocate Stock (Committed to Order)
Soft-allocate available on-hand stock for an open order.

*   **URL**: `/api/inventory/allocate`
*   **Method**: `POST`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Role required: `admin`, `warehouse_operator`)
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `sku` (string, Required): Product SKU.
        *   `amount` (number, Required): Integer quantity to allocate.
        *   `locationId` (string, Optional): Warehouse location to allocate from.
*   **Request Body**:
    ```json
    {
      "sku": "IPHONE-15-PRO-BLK",
      "amount": 2,
      "locationId": "LOC-A1"
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    { "message": "Stock allocated successfully" }
    ```
*   **Workflow**: Reserves available inventory for confirmed customer orders to prevent double-selling.

---

### 5. Release / Fulfill Allocation
Release previously allocated stock back to available pool or finalize fulfillment.

*   **URL**: `/api/inventory/release-allocation` or `/api/inventory/fulfill-allocation`
*   **Method**: `POST`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Role required: `admin`, `warehouse_operator`)
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `sku` (string, Required): Product SKU.
        *   `amount` (number, Required): Integer quantity.
        *   `locationId` (string, Optional): Warehouse location.
*   **Request Body**:
    ```json
    {
      "sku": "IPHONE-15-PRO-BLK",
      "amount": 2,
      "locationId": "LOC-A1"
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    { "message": "Allocation released successfully" }
    ```
*   **Workflow**: Release allocation cancels reservation upon order cancellation; fulfillment finalizes outbound deduction.

---

### 6. Create / Receive Stock In-Transit
Manage inventory transfers between facilities while goods are in transit.

*   **URL**: `/api/inventory/create-in-transit` or `/api/inventory/receive-in-transit`
*   **Method**: `POST`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Role required: `admin`, `warehouse_operator`)
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `sku` (string, Required): Product SKU.
        *   `amount` (number, Required): Positive integer quantity.
        *   `locationId` (string, Optional): Origin or destination location.
*   **Request Body**:
    ```json
    {
      "sku": "IPHONE-15-PRO-BLK",
      "amount": 10,
      "locationId": "LOC-A1"
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    { "message": "In-transit stock created successfully" }
    ```
*   **Workflow**: Tracks stock leaving one warehouse and arriving at another facility.

---

## 📝 Physical Audits & Cycle Counts

### 1. Create Count Session
Initiate a new physical inventory audit session.

*   **URL**: `/api/audits`
*   **Method**: `POST`
*   **Headers**: `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `auditNumber` (string, Required): Unique audit reference code.
        *   `tenantId` (string, Required): Tenant ID.
        *   `locationId` (string, Required): Warehouse location being audited.
        *   `variantIds` (array of strings, Required): List of SKUs/variants to audit.
*   **Request Body**:
    ```json
    {
      "auditNumber": "AUD-2026-01",
      "tenantId": "tenant-1",
      "locationId": "LOC-A1",
      "variantIds": ["IPHONE-15-PRO-BLK"]
    }
    ```
*   **Success Response**: `201 Created`
    ```json
    {
      "id": "aud_123",
      "auditNumber": "AUD-2026-01",
      "tenantId": "tenant-1",
      "locationId": "LOC-A1",
      "status": "DRAFT",
      "items": [
        {
          "id": "item_1",
          "variantId": "IPHONE-15-PRO-BLK",
          "expectedQuantity": 50,
          "countedQuantity": null,
          "discrepancy": null,
          "isCounted": false
        }
      ]
    }
    ```
*   **Workflow**: Creates a draft snapshot of expected stock quantities before physical floor counts begin.

---

### 2. Start Count Session
Transition an audit session from draft to active counting.

*   **URL**: `/api/audits/:id/start`
*   **Method**: `POST`
*   **Parameters**:
    *   **Path**:
        *   `id` (string, Required): The audit ID.
*   **Success Response**: `200 OK`
    ```json
    { "message": "Inventory audit started successfully" }
    ```
*   **Workflow**: Locks count scope and enables warehouse floor workers to enter physical count results.

---

### 3. Record Count Item
Submit a physical count result for an item in the audit.

*   **URL**: `/api/audits/:id/count`
*   **Method**: `POST`
*   **Headers**: `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Path**:
        *   `id` (string, Required): The audit ID.
    *   **Body**:
        *   `variantId` (string, Required): Product SKU / variant identifier.
        *   `countedQuantity` (number, Required): Physical quantity counted on shelf.
*   **Request Body**:
    ```json
    {
      "variantId": "IPHONE-15-PRO-BLK",
      "countedQuantity": 48
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    { "message": "Count recorded successfully" }
    ```
*   **Workflow**: Submits verified shelf counts, calculating differences against recorded system stock.

---

### 4. Complete & Reconcile Audit
Finalize the count session and reconcile discrepancies against ledger balances.

*   **Complete URL**: `/api/audits/:id/complete` (`POST`)
*   **Reconcile URL**: `/api/audits/:id/reconcile` (`POST`)
*   **Parameters**:
    *   **Path**:
        *   `id` (string, Required): The audit ID.
*   **Success Response**: `200 OK`
    ```json
    { "message": "Inventory audit reconciled successfully" }
    ```
*   **Workflow**: Finalizing reconciles system quantities with physical counts and generates balancing journal entries.

---

## 🧾 Accrual & Cash Accounting

### 1. Get Journal Ledger
Retrieve financial journal entries recorded for inventory transactions.

*   **URL**: `/api/accounting/ledger`
*   **Method**: `GET`
*   **Headers**: `Authorization: Bearer <token>` (Optional)
*   **Parameters**: None
*   **Success Response**: `200 OK`
    ```json
    [
      {
        "id": "entry_1",
        "date": "2026-03-30T12:00:00.000Z",
        "description": "Stock received",
        "referenceId": "po-123",
        "lines": [
          { "accountId": "INVENTORY", "debitCents": 10000, "creditCents": 0 },
          { "accountId": "AP", "debitCents": 0, "creditCents": 10000 }
        ]
      }
    ]
    ```
*   **Workflow**: Used by accounting systems to audit double-entry balances and track inventory asset valuations.

---

### 2. Calculate Stock Valuation (Cost Layers)
Calculate inventory valuation based on FIFO or Weighted Average Cost layers.

*   **URL**: `/api/accounting/valuation/:variantId`
*   **Method**: `GET`
*   **Parameters**:
    *   **Path**:
        *   `variantId` (string, Required): Product SKU / variant ID.
    *   **Query**:
        *   `quantity` (string, Optional): Units to evaluate (defaults to 1).
        *   `tenantId` (string, Optional): Tenant identifier (defaults to `DEFAULT`).
        *   `method` (string, Optional): Costing strategy (`fifo` or `wac`).
*   **Success Response**: `200 OK`
    ```json
    {
      "variantId": "IPHONE-15-PRO-BLK",
      "quantity": 10,
      "totalCostCents": 999000,
      "unitCostCents": 99900,
      "methodUsed": "fifo"
    }
    ```
*   **Workflow**: Provides financial stock valuations for balance sheet reporting and Cost of Goods Sold (COGS) computations.

---

## 🏷️ Barcodes, Serial Tracking & RMA Returns

### 1. Assign Barcode to SKU
Link a barcode symbol to an inventory product SKU.

*   **URL**: `/api/barcodes/assign`
*   **Method**: `POST`
*   **Headers**: `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `variantId` (string, Required): Product variant ID / SKU.
        *   `symbology` (string, Required): Symbology format (e.g., `upc_a`, `ean_13`, `code_128`, `qr_code`).
        *   `barcodeValue` (string, Required): Barcode character string.
        *   `source` (string, Required): Origin of barcode (`supplier` or `internal`).
        *   `isPrimary` (boolean, Optional): Whether this barcode is the primary scanning barcode.
*   **Request Body**:
    ```json
    {
      "variantId": "IPHONE-15-PRO-BLK",
      "barcodeValue": "012345678901",
      "symbology": "upc_a",
      "source": "supplier",
      "isPrimary": true
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    {
      "message": "Barcode assigned successfully.",
      "variantId": "IPHONE-15-PRO-BLK",
      "barcodeValue": "012345678901"
    }
    ```
*   **Workflow**: Maps manufacturer or warehouse barcodes to internal SKUs for optical scanning workflows.

---

### 2. Register Serialized Item
Register an individual serialized item under a product variant.

*   **URL**: `/api/serials/register`
*   **Method**: `POST`
*   **Headers**: `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `serialNumber` (string, Required): Unique serial number string.
        *   `variantId` (string, Required): Associated product SKU/variant.
        *   `locationId` (string, Required): Location where item is registered.
        *   `actorId` (string, Required): User or system registering the item.
        *   `tenantId` (string, Optional): Tenant ID (defaults to `DEFAULT`).
*   **Request Body**:
    ```json
    {
      "serialNumber": "SN-987654",
      "variantId": "IPHONE-15-PRO-BLK",
      "locationId": "LOC-A1",
      "actorId": "usr_admin",
      "tenantId": "tenant-1"
    }
    ```
*   **Success Response**: `201 Created`
    ```json
    {
      "message": "Serial number registered.",
      "id": "ser_123",
      "serialNumber": "SN-987654"
    }
    ```
*   **Workflow**: Tracks individual high-value items throughout lifecycle from receipt through sales and return.

---

### 3. Create & Receive RMA Returns
Initiate a Return Merchandise Authorization and receive returned goods.

*   **Create RMA**:
    *   **URL**: `/api/returns/rma`
    *   **Method**: `POST`
    *   **Headers**:
        *   `Authorization: Bearer <token>` (Required, Role required: `admin`, `warehouse_operator`)
        *   `Content-Type: application/json` (Required)
    *   **Parameters**:
        *   `body`: `rmaNumber`, `tenantId`, `customerId`, `locationId`, and `items` array.
    *   **Success Response**: `201 Created`
*   **Receive RMA**:
    *   **URL**: `/api/returns/rma/:id/receive`
    *   **Method**: `POST`
    *   **Headers**:
        *   `Authorization: Bearer <token>` (Required, Role required: `admin`, `warehouse_operator`)
    *   **Parameters**:
        *   **Path**: `id` (string, Required): RMA identifier.
        *   **Body**: `items` array with `variantId`, `quantityReceived`, and `disposition` (`Restock`, `Quarantine`, or `Scrap`).
    *   **Success Response**: `200 OK`
        ```json
        { "message": "RMA items received and processed successfully" }
        ```
*   **Workflow**: Customer return workflow that routes items into quarantine or back to restocked inventory.

---

### 4. Resolve Quarantine Item
Determine disposition and resolve quarantined items.

*   **URL**: `/api/returns/quarantine/:id/resolve`
*   **Method**: `POST`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Role required: `admin`, `warehouse_operator`)
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Path**:
        *   `id` (string, Required): Quarantine item identifier.
    *   **Body**:
        *   `resolution` (string, Required): Resolution type (`RESTOCKED`, `SCRAPPED`, `RTV`).
*   **Request Body**:
    ```json
    {
      "resolution": "RESTOCKED"
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    { "message": "Quarantine item resolved successfully" }
    ```
*   **Workflow**: Completes quality assurance review of quarantined goods, either returning them to active stock or writing them off.

---

## 🛠️ Kits & Bundles

*   **Create Kit**: `POST /api/kits/create`
    *   **Headers**: `Content-Type: application/json` (Required)
    *   **Body**: `{ "sku": "KIT-BUNDLE-1", "name": "Travel Bundle", "components": [{ "variantId": "COMP-A", "quantity": 1 }] }`
    *   **Success**: `201 Created`
*   **Sell Kit**: `POST /api/kits/dispatch`
    *   **Headers**: `Content-Type: application/json` (Required)
    *   **Body**: `{ "kitSku": "KIT-BUNDLE-1", "quantity": 1, "saleId": "ORD-1", "actorId": "usr_1" }`
    *   **Success**: `200 OK`
*   **Assemble Kit**: `POST /api/kits/assemble`
    *   **Headers**: `Authorization: Bearer <token>` (Required, Role required: `admin`, `warehouse_operator`), `Content-Type: application/json`
    *   **Body**: `{ "kitSku": "KIT-BUNDLE-1", "quantity": 5, "locationId": "LOC-A1", "referenceId": "ASM-001" }`
    *   **Success**: `200 OK`
*   **Disassemble Kit**: `POST /api/kits/disassemble`
    *   **Headers**: `Authorization: Bearer <token>` (Required, Role required: `admin`, `warehouse_operator`), `Content-Type: application/json`
    *   **Body**: `{ "kitSku": "KIT-BUNDLE-1", "quantity": 2, "locationId": "LOC-A1", "referenceId": "DIS-001" }`
    *   **Success**: `200 OK`
*   **Workflow**: Kit formula definition, dynamic component depletion during sales, and explicit assembly / teardown operations.

---

## 📈 Demand Forecasting & Shipping

### 1. Generate Demand Forecast
Forecast future SKU demand using historical consumption patterns.

*   **URL**: `/api/forecasting/forecast`
*   **Method**: `POST`
*   **Headers**: `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `sku` (string, Required): Target product SKU.
        *   `locationId` (string, Optional): Location filter (defaults to `default`).
        *   `forecastDays` (number, Optional): Lookahead duration in days (defaults to 30).
        *   `trendMultiplier` (number, Optional): Projected demand multiplier (defaults to 1.0).
*   **Request Body**:
    ```json
    {
      "sku": "IPHONE-15-PRO-BLK",
      "locationId": "LOC-A1",
      "forecastDays": 30,
      "trendMultiplier": 1.1
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    {
      "message": "Demand forecast generated successfully",
      "forecast": {
        "id": "fc_123",
        "sku": "IPHONE-15-PRO-BLK",
        "locationId": "LOC-A1",
        "forecastedQuantity": 150,
        "confidenceLevel": 0.85
      }
    }
    ```
*   **Workflow**: Informs purchasing and replenishing decisions through automated predictive modeling.

---

### 2. Fetch Planning Report
Retrieve comprehensive inventory replenishment planning reports.

*   **URL**: `/api/forecasting/report`
*   **Method**: `GET`
*   **Parameters**:
    *   **Query**:
        *   `locationId` (string, Optional): Warehouse location filter (defaults to `default`).
*   **Success Response**: `200 OK`
    ```json
    {
      "generatedAt": "2026-03-30T12:00:00.000Z",
      "locationId": "LOC-A1",
      "items": [
        {
          "sku": "IPHONE-15-PRO-BLK",
          "currentStock": 20,
          "reorderPoint": 50,
          "suggestedReorderQuantity": 80
        }
      ]
    }
    ```
*   **Workflow**: Warehouse planners run weekly demand reports to trigger automated or manual replenishment orders.

---

### 3. Rate Shopping (Carrier Shipping Integration)
Query shipping rate quotes across supported logistics carriers.

*   **URL**: `/api/shipping/rates`
*   **Method**: `GET`
*   **Parameters**: None
*   **Success Response**: `200 OK`
    ```json
    [
      { "carrier": "FedEx", "service": "Ground", "rateCents": 1250, "estimatedDays": 3 },
      { "carrier": "UPS", "service": "Ground", "rateCents": 1190, "estimatedDays": 3 }
    ]
    ```
*   **Workflow**: Real-time rate calculation comparing carrier options for outbound fulfillment orders.

---

### 4. Purchase Shipping Label & Track
Purchase shipping labels and track delivery progress.

*   **Purchase Label**:
    *   **URL**: `/api/shipping/labels`
    *   **Method**: `POST`
    *   **Headers**: `Content-Type: application/json` (Required)
    *   **Body**: `{ "sku": "IPHONE-15-PRO-BLK", "quantity": 1, "destinationAddress": "123 Main St", "carrier": "FedEx", "locationId": "LOC-A1" }`
    *   **Success**: `201 Created`
*   **Track Shipment**:
    *   **URL**: `/api/shipping/shipments/:id/track`
    *   **Method**: `POST`
    *   **Headers**: `Content-Type: application/json` (Required)
    *   **Body**: `{ "status": "IN_TRANSIT" }`
    *   **Success**: `200 OK`
*   **Workflow**: Logistics dispatch flow generating tracking numbers, printing shipping labels, and publishing outbox events.

---

## 🐳 Integrations & Outbox

### 1. Shopify Order Webhook
Receive external order creation events from Shopify stores.

*   **URL**: `/api/shopify/webhooks/orders/create`
*   **Method**: `POST`
*   **Headers**:
    *   `x-shopify-hmac-sha256` (string, Required): HMAC signature header verifying authenticity against `SHOPIFY_API_SECRET`.
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `id` (string/number, Required): Shopify order ID.
        *   `line_items` (array, Required): Array of ordered items with `sku` and `quantity`.
*   **Request Body**:
    ```json
    {
      "id": 123456789,
      "line_items": [
        { "sku": "IPHONE-15-PRO-BLK", "quantity": 1 }
      ]
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    { "success": true }
    ```
*   **Workflow**: Ingests new e-commerce orders, automatically deducting inventory and triggering fulfillment pipelines.

---

### 2. Outbox Event Log Status & Dead-Letter Retry
Monitor transactional outbox event relay status and reprocess failed messages.

*   **Outbox Event Log Status**:
    *   **URL**: `/api/outbox/stats`
    *   **Method**: `GET`
    *   **Success Response**: `200 OK`
        ```json
        {
          "pending": 0,
          "published": 142,
          "deadLettered": 1
        }
        ```
*   **Dead-Letter Message Retry**:
    *   **URL**: `/api/outbox/:id/retry`
    *   **Method**: `POST`
    *   **Parameters**:
        *   **Path**: `id` (string, Required): Identifier of the dead-lettered message.
    *   **Success Response**: `200 OK`
        ```json
        { "message": "Outbox event queued for retry" }
        ```
*   **Workflow**: Guarantees at-least-once message delivery to downstream brokers (Kafka/RabbitMQ) with manual retry recovery for failed dispatches.

---

## 🔒 Compliance Ledger (Audit Trails)

### 1. Fetch Compliance Audit Logs
Query the tamper-evident cryptographically signed compliance ledger.

*   **URL**: `/api/compliance/ledger`
*   **Method**: `GET`
*   **Parameters**:
    *   **Query**:
        *   `tenantId` (string, Optional): Tenant identifier.
*   **Success Response**: `200 OK`
    ```json
    [
      {
        "id": "block_1",
        "tenantId": "tenant-1",
        "eventType": "STOCK_DISPATCHED",
        "payloadHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "previousHash": "0000000000000000000000000000000000000000000000000000000000000000",
        "signature": "3045022100...",
        "timestamp": "2026-03-30T12:00:00.000Z"
      }
    ]
    ```
*   **Workflow**: Provides immutable audit logs for regulatory compliance and internal security inspection.

---

### 2. Verify Ledger Integrity
Verify the cryptographic hash-chain and digital signatures across all blocks in the ledger.

*   **URL**: `/api/compliance/verify`
*   **Method**: `POST`
*   **Parameters**:
    *   **Query**:
        *   `tenantId` (string, Optional): Tenant identifier.
*   **Success Response**: `200 OK`
    ```json
    { "isValid": true }
    ```
*   **Workflow**: Runs mathematical hash-chain continuity checks and public key signature verification across the entire audit log.
