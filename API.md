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

---

## 🛒 Procurement & Purchase Orders

### 1. Create Purchase Order
Initialize a new purchase order draft for a supplier with requested line items.

*   **URL**: `/api/purchase-orders`
*   **Method**: `POST`
*   **Headers**: `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `purchaseOrderNumber` (string, Required): Unique purchase order reference code.
        *   `vendorId` (string, Required): Unique supplier/vendor identifier.
        *   `tenantId` (string, Required): Tenant ID.
        *   `locationId` (string, Required): Destination warehouse location ID.
        *   `requesterId` (string, Optional): User or actor ID submitting the order.
        *   `items` (array of objects, Required): Array of purchase order items:
            *   `variantId` (string, Required): Product SKU / variant identifier.
            *   `quantity` (number, Required): Quantity ordered (positive integer).
            *   `unitCostCents` (number, Required): Agreed cost per unit in cents.
*   **Request Body**:
    ```json
    {
      "purchaseOrderNumber": "PO-2026-001",
      "vendorId": "vendor-123",
      "tenantId": "tenant-1",
      "locationId": "LOC-A1",
      "items": [
        { "variantId": "IPHONE-15-PRO-BLK", "quantity": 10, "unitCostCents": 80000 },
        { "variantId": "IPAD-AIR-64GB", "quantity": 5, "unitCostCents": 50000 }
      ]
    }
    ```
*   **Success Response**: `201 Created`
    ```json
    {
      "id": "po_123",
      "purchaseOrderNumber": "PO-2026-001",
      "status": "DRAFT",
      "vendorId": "vendor-123",
      "tenantId": "tenant-1",
      "locationId": "LOC-A1",
      "items": [
        {
          "id": "item_1",
          "variantId": "IPHONE-15-PRO-BLK",
          "quantity": 10,
          "receivedQuantity": 0,
          "unitCostCents": 80000
        },
        {
          "id": "item_2",
          "variantId": "IPAD-AIR-64GB",
          "quantity": 5,
          "receivedQuantity": 0,
          "unitCostCents": 50000
        }
      ]
    }
    ```
*   **Workflow**: Creates a draft purchase order with vendor details and line item pricing; evaluates approval workflows if spending thresholds require managerial sign-off.

---

### 2. Get Purchase Order
Retrieve detailed information and line item fulfillment status for a specific purchase order.

*   **URL**: `/api/purchase-orders/:id`
*   **Method**: `GET`
*   **Parameters**:
    *   **Path**:
        *   `id` (string, Required): Unique identifier of the purchase order.
*   **Success Response**: `200 OK`
    ```json
    {
      "id": "po_123",
      "purchaseOrderNumber": "PO-2026-001",
      "status": "APPROVED",
      "vendorId": "vendor-123",
      "tenantId": "tenant-1",
      "locationId": "LOC-A1",
      "items": [
        {
          "id": "item_1",
          "variantId": "IPHONE-15-PRO-BLK",
          "quantity": 10,
          "receivedQuantity": 0,
          "unitCostCents": 80000
        }
      ]
    }
    ```
*   **Workflow**: Inspects purchase order metadata, approval status, and tracking quantities received against quantities ordered.

---

### 3. Approve Purchase Order
Approve a draft purchase order for submission to the supplier.

*   **URL**: `/api/purchase-orders/:id/approve`
*   **Method**: `POST`
*   **Parameters**:
    *   **Path**:
        *   `id` (string, Required): Unique identifier of the purchase order.
*   **Success Response**: `200 OK`
    ```json
    { "message": "Purchase order approved successfully" }
    ```
*   **Workflow**: Transitions a draft or pending purchase order into the approved state following internal budget or supervisor approval.

---

### 4. Send Purchase Order
Mark an approved purchase order as dispatched/sent to the supplier.

*   **URL**: `/api/purchase-orders/:id/send`
*   **Method**: `POST`
*   **Parameters**:
    *   **Path**:
        *   `id` (string, Required): Unique identifier of the purchase order.
*   **Success Response**: `200 OK`
    ```json
    { "message": "Purchase order sent to vendor successfully" }
    ```
*   **Workflow**: Updates order state to sent once communication has been confirmed with the supplier, anticipating inbound delivery.

---

### 5. Receive Purchase Order Items
Record inbound goods receipt against an active purchase order, updating inventory stock and creating accounting cost layers.

*   **URL**: `/api/purchase-orders/:id/receive`
*   **Method**: `POST`
*   **Headers**: `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Path**:
        *   `id` (string, Required): Unique identifier of the purchase order.
    *   **Body**:
        *   `items` (array of objects, Required): Array of received item updates:
            *   `variantId` (string, Required): Product SKU / variant identifier.
            *   `quantityReceived` (number, Required): Positive quantity physically received.
*   **Request Body**:
    ```json
    {
      "items": [
        { "variantId": "IPHONE-15-PRO-BLK", "quantityReceived": 10 },
        { "variantId": "IPAD-AIR-64GB", "quantityReceived": 5 }
      ]
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    { "message": "Items received successfully" }
    ```
*   **Workflow**: Receiving dock operators scan or confirm delivered items against the PO. Updates line item received quantities, marks PO as PartiallyReceived or Received, increments on-hand warehouse inventory, and logs FIFO/WAC cost layers.

---

## 📍 Warehouse Locations & WMS Routing

### 1. Create or Save Warehouse Location
Define or update a warehouse storage location with physical capacity limits and coordinates.

*   **URL**: `/api/warehouse-locations`
*   **Method**: `POST`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Role required: `admin`, `warehouse_operator`)
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `path` (string, Optional): Standard location path string (e.g. `WH1-ZONEA-A01-R01-S01-B01`). When provided, location components are parsed automatically.
        *   `warehouseId` (string, Optional): Warehouse identifier (required if `path` is not provided).
        *   `zone` (string, Optional): Warehouse zone identifier (required if `path` is not provided).
        *   `aisle` (string, Optional): Aisle designation (required if `path` is not provided).
        *   `rack` (string, Optional): Rack identifier (required if `path` is not provided).
        *   `shelf` (string, Optional): Shelf identifier (required if `path` is not provided).
        *   `bin` (string, Optional): Bin compartment code (required if `path` is not provided).
        *   `maxWeightGrams` (number, Optional): Maximum weight capacity supported in grams.
        *   `maxVolumeCubicMeters` (number, Optional): Maximum volume capacity supported in cubic meters.
        *   `gridX` (number, Optional): Floor layout X coordinate (defaults to 0).
        *   `gridY` (number, Optional): Floor layout Y coordinate (defaults to 0).
        *   `width` (number, Optional): Spatial width in grid units (defaults to 1).
        *   `height` (number, Optional): Spatial height in grid units (defaults to 1).
*   **Request Body**:
    ```json
    {
      "path": "WH1-ZONEA-A01-R01-S01-B01",
      "maxWeightGrams": 50000,
      "maxVolumeCubicMeters": 2.0,
      "gridX": 10,
      "gridY": 5
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    {
      "message": "Warehouse location saved successfully.",
      "location": {
        "id": "WH1-ZONEA-A01-R01-S01-B01",
        "warehouseId": "WH1",
        "zone": "ZONEA",
        "aisle": "A01",
        "rack": "R01",
        "shelf": "S01",
        "bin": "B01",
        "maxWeightGrams": 50000,
        "maxVolumeCubicMeters": 2.0,
        "gridX": 10,
        "gridY": 5,
        "width": 1,
        "height": 1
      }
    }
    ```
*   **Workflow**: Logistics administrators map physical facility topography, establish volumetric / weight constraints, and assign spatial coordinates for routing.

---

### 2. List Warehouse Locations
Retrieve all configured warehouse storage locations and capacity thresholds.

*   **URL**: `/api/warehouse-locations`
*   **Method**: `GET`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required)
*   **Parameters**: None
*   **Success Response**: `200 OK`
    ```json
    [
      {
        "id": "WH1-ZONEA-A01-R01-S01-B01",
        "warehouseId": "WH1",
        "zone": "ZONEA",
        "aisle": "A01",
        "rack": "R01",
        "shelf": "S01",
        "bin": "B01",
        "maxWeightGrams": 50000,
        "maxVolumeCubicMeters": 2.0,
        "gridX": 10,
        "gridY": 5,
        "width": 1,
        "height": 1
      }
    ]
    ```
*   **Workflow**: Used by warehouse management dashboards and handheld scanners to display available bin locations and capacity ceilings.

---

### 3. Delete Warehouse Location
Remove a storage location from the facility configuration.

*   **URL**: `/api/warehouse-locations/:id`
*   **Method**: `DELETE`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Role required: `admin`, `warehouse_operator`)
*   **Parameters**:
    *   **Path**:
        *   `id` (string, Required): The identifier of the location to delete (e.g. `WH1-ZONEA-A01-R01-S01-B01`).
*   **Success Response**: `200 OK`
    ```json
    { "message": "Warehouse location deleted successfully." }
    ```
*   **Workflow**: Decommissions obsolete racks, shelves, or damaged storage bins from active routing and putaway engines.

---

### 4. Suggest Putaway Locations
Generate intelligent putaway location recommendations for inbound items based on SKU characteristics and bin capacities.

*   **URL**: `/api/warehouse-locations/putaway-suggestions`
*   **Method**: `POST`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required)
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `sku` (string, Required): Product SKU being received.
        *   `quantity` (number, Required): Quantity of units to put away.
*   **Request Body**:
    ```json
    {
      "sku": "FAST-SKU",
      "quantity": 10
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    [
      {
        "locationId": "WH1-FAST-A01-R01-S01-B01",
        "score": 95,
        "reason": "Fast-moving SKU placed near dispatch dock with available capacity"
      }
    ]
    ```
*   **Workflow**: Inbound dock workers query putaway recommendations to place high-velocity SKUs near front aisles, hazardous items into hazmat zones, and temperature-controlled items into cold storage.

---

### 5. Optimize Serpentine Pick Route
Calculate an optimal pick route across multiple warehouse bins using serpentine (S-shape) aisle traversal.

*   **URL**: `/api/warehouse-locations/optimize-pick-route`
*   **Method**: `POST`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required)
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**: Provide either `items` or `skus`:
        *   `items` (array of objects, Optional): Explicit list of pick items:
            *   `sku` (string, Required): Item SKU.
            *   `quantity` (number, Required): Quantity to pick.
            *   `locationId` (string, Required): Target bin location ID.
        *   `skus` (array of strings, Optional): Array of SKUs to automatically resolve to on-hand inventory locations.
*   **Request Body**:
    ```json
    {
      "items": [
        { "sku": "SKU1", "quantity": 2, "locationId": "WH1-ZONEA-A02-R01-S01-B01" },
        { "sku": "SKU2", "quantity": 1, "locationId": "WH1-ZONEA-A01-R02-S01-B01" },
        { "sku": "SKU3", "quantity": 5, "locationId": "WH1-ZONEA-A01-R01-S01-B01" },
        { "sku": "SKU4", "quantity": 3, "locationId": "WH1-ZONEA-A02-R02-S01-B01" }
      ]
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    [
      {
        "zone": "ZONEA",
        "items": [
          { "sku": "SKU3", "quantity": 5, "locationId": "WH1-ZONEA-A01-R01-S01-B01" },
          { "sku": "SKU2", "quantity": 1, "locationId": "WH1-ZONEA-A01-R02-S01-B01" },
          { "sku": "SKU4", "quantity": 3, "locationId": "WH1-ZONEA-A02-R02-S01-B01" },
          { "sku": "SKU1", "quantity": 2, "locationId": "WH1-ZONEA-A02-R01-S01-B01" }
        ]
      }
    ]
    ```
*   **Workflow**: Order fulfillment pickers generate sequenced pick lists traversing aisles in an alternating serpentine pattern (odd aisles ascending, even aisles descending) to minimize warehouse travel time.

---

### 6. Warehouse Slotting Suggestions
Analyze dispatch velocity and inventory placement to recommend optimal SKU re-slotting.

*   **URL**: `/api/warehouse-locations/slotting-suggestions`
*   **Method**: `GET`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Role required: `admin`, `warehouse_operator`)
*   **Parameters**: None
*   **Success Response**: `200 OK`
    ```json
    [
      {
        "sku": "IPHONE-15-PRO-BLK",
        "currentLocationId": "WH1-ZONEB-A05-R02-S01-B01",
        "suggestedLocationId": "WH1-ZONEA-A01-R01-S01-B01",
        "reason": "High pick velocity warrants relocation to front fast-pick zone"
      }
    ]
    ```
*   **Workflow**: Periodic warehouse optimization workflow providing data-driven recommendations to reposition fast-moving SKUs closer to packing stations.

---

## 🛡️ Roles & Permissions (RBAC)

### 1. List System Permissions
Retrieve all available granular resource permissions defined across the application.

*   **URL**: `/api/roles/permissions`
*   **Method**: `GET`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Role required: `admin`, Permission required: `user:edit_role`)
*   **Parameters**: None
*   **Success Response**: `200 OK`
    ```json
    {
      "permissions": [
        {
          "id": "perm_inv_read",
          "resource": "inventory",
          "action": "read",
          "description": "Read inventory items and stock levels"
        },
        {
          "id": "perm_user_edit_role",
          "resource": "user",
          "action": "edit_role",
          "description": "Create and manage custom roles"
        }
      ]
    }
    ```
*   **Workflow**: Used by admin console dashboards when creating or editing custom roles to present assignable capabilities.

---

### 2. List Roles
Retrieve all predefined system roles as well as tenant-specific custom roles along with their assigned permissions.

*   **URL**: `/api/roles`
*   **Method**: `GET`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Role required: `admin`, Permission required: `user:edit_role`)
*   **Parameters**: None
*   **Success Response**: `200 OK`
    ```json
    [
      {
        "id": "role_admin",
        "name": "admin",
        "description": "Full administrative access",
        "isCustom": false,
        "permissions": [
          {
            "id": "perm_all",
            "resource": "*",
            "action": "*",
            "description": "Full access"
          }
        ]
      },
      {
        "id": "custom_tenant-1_auditor_1700000000000",
        "name": "Inventory Auditor",
        "description": "Auditor with read-only stock and count reconciliation access",
        "isCustom": true,
        "permissions": [
          {
            "id": "perm_inv_read",
            "resource": "inventory",
            "action": "read",
            "description": "Read inventory items and stock levels"
          }
        ]
      }
    ]
    ```
*   **Workflow**: Administrators inspect currently configured roles and assigned permission sets within their tenant organization.

---

### 3. Create Custom Role
Create a new tenant-scoped custom role with a designated set of permission IDs.

*   **URL**: `/api/roles`
*   **Method**: `POST`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Role required: `admin`, Permission required: `user:edit_role`)
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `name` (string, Required): Unique display name for the custom role.
        *   `description` (string, Optional): Description of role duties and access level.
        *   `permissionIds` (array of strings, Optional): Array of valid permission IDs to assign to the role.
*   **Request Body**:
    ```json
    {
      "name": "Receiving Lead",
      "description": "Supervises inbound goods receipt and warehouse putaway",
      "permissionIds": ["perm_inv_receive", "perm_po_receive"]
    }
    ```
*   **Success Response**: `201 Created`
    ```json
    {
      "success": true,
      "message": "Role created successfully.",
      "id": "custom_tenant-1_receiving_lead_1700000000000"
    }
    ```
*   **Error Responses**:
    *   `400 Bad Request`: If `name` is missing or if any item in `permissionIds` does not exist.
        ```json
        { "error": "name is required." }
        ```
*   **Workflow**: Administrators tailor granular roles matching job functions and assign them to staff members.

---

### 4. Update Role Permissions
Replace the complete set of permissions assigned to an existing custom or system role.

*   **URL**: `/api/roles/:roleId/permissions`
*   **Method**: `PUT`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Role required: `admin`)
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Path**:
        *   `roleId` (string, Required): Identifier of the target role.
    *   **Body**:
        *   `permissionIds` (array of strings, Required): Array of valid permission IDs to associate with this role.
*   **Request Body**:
    ```json
    {
      "permissionIds": ["perm_inv_read", "perm_inv_receive", "perm_inv_dispatch"]
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    {
      "success": true,
      "message": "Role permissions updated successfully."
    }
    ```
*   **Error Responses**:
    *   `400 Bad Request`: If `permissionIds` is not an array or contains invalid permission IDs.
    *   `404 Not Found`: If `roleId` does not exist.
*   **Workflow**: Modifies the capability set for an existing role, immediately affecting permissions for all assigned users.

---

### 5. Delete Custom Role
Delete a tenant custom role. Built-in system roles or roles currently assigned to users cannot be deleted.

*   **URL**: `/api/roles/:roleId`
*   **Method**: `DELETE`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Role required: `admin`)
*   **Parameters**:
    *   **Path**:
        *   `roleId` (string, Required): Identifier of the custom role to delete.
*   **Success Response**: `200 OK`
    ```json
    {
      "success": true,
      "message": "Role deleted successfully."
    }
    ```
*   **Error Responses**:
    *   `403 Forbidden`: If attempting to delete a built-in system role or a role currently assigned to one or more users.
        ```json
        { "error": "Cannot delete a built-in system role." }
        ```
    *   `404 Not Found`: If `roleId` does not exist.
*   **Workflow**: Clean up unused custom roles that have been decommissioned and unassigned from all users.

---

## 🔔 Notifications & Preferences
Manage system alerts, in-app notifications, and per-user delivery channel preferences for operational events (such as low stock, order discrepancies, and audits).

### 1. Fetch Unread Notifications
Retrieve all active, unread notifications for a specified tenant, ordered by creation date descending.

*   **URL**: `/api/notifications/:tenantId`
*   **Method**: `GET`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required)
*   **Parameters**:
    *   **Path**:
        *   `tenantId` (string, Required): The unique identifier of the tenant.
*   **Success Response**: `200 OK`
    ```json
    [
      {
        "id": "e44c219a-9e12-4f36-963d-4c3dcfefd092",
        "tenantId": "tenant-1",
        "title": "Low Stock Warning",
        "message": "SKU-SAMPLE-1 stock level has fallen below minimum threshold of 10 units at LOC-MAIN.",
        "type": "warning",
        "isRead": false,
        "createdAt": "2026-11-06T15:30:00.000Z"
      }
    ]
    ```
*   **Error Responses**:
    *   `500 Internal Server Error`: If fetching notifications fails.
        ```json
        { "error": "Failed to fetch notifications" }
        ```
*   **Workflow**: Front-end applications poll or load unread notifications on dashboard launch to display active alerts and warnings to warehouse managers and inventory operators.

---

### 2. Mark Notification as Read
Acknowledge and mark a single notification as read by its unique identifier.

*   **URL**: `/api/notifications/:id/read`
*   **Method**: `PATCH`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required)
*   **Parameters**:
    *   **Path**:
        *   `id` (string, Required): Unique notification record identifier.
*   **Success Response**: `200 OK`
    *(Empty response body)*
*   **Error Responses**:
    *   `500 Internal Server Error`: If updating the notification status fails.
        ```json
        { "error": "Failed to mark notification as read" }
        ```
*   **Workflow**: Invoked when an operator views or dismisses a notification from their notification drawer or bell icon in the web dashboard.

---

### 3. Save Notification Preferences
Create or update delivery preferences for an individual user across notification channels and event types (upsert).

*   **URL**: `/api/notifications/preferences`
*   **Method**: `POST`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required)
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `userId` (string, Required): Unique identifier of the user.
        *   `tenantId` (string, Required): Unique identifier of the user's tenant organization.
        *   `channel` (string, Required): Delivery channel name (e.g. `"EMAIL"`, `"SMS"`, `"IN_APP"`, `"WEBHOOK"`).
        *   `eventType` (string, Required): Target event category identifier (e.g. `"LOW_STOCK"`, `"AUDIT_DISCREPANCY"`, `"ALL"`).
        *   `isEnabled` (boolean, Required): Boolean flag toggling delivery on (`true`) or off (`false`).
*   **Request Body**:
    ```json
    {
      "userId": "usr_ops_01",
      "tenantId": "tenant-1",
      "channel": "EMAIL",
      "eventType": "LOW_STOCK",
      "isEnabled": true
    }
    ```
*   **Success Response**: `201 Created`
    ```json
    {
      "id": "pref_c0a80101-7b91-4e44-88aa-123456789abc",
      "userId": "usr_ops_01",
      "tenantId": "tenant-1",
      "channel": "EMAIL",
      "eventType": "LOW_STOCK",
      "isEnabled": true,
      "createdAt": "2026-11-06T16:00:00.000Z"
    }
    ```
*   **Error Responses**:
    *   `500 Internal Server Error`: If saving preference configurations fails.
        ```json
        { "error": "Failed to save preferences" }
        ```
*   **Workflow**: Users customize their alert dispatch channels within account settings to control which events trigger in-app, email, or webhook notifications.

---

## ⚖️ Approval Workflows & Requests

Configure multi-tier approval rules and submit decisions for operations that exceed risk or budget thresholds (e.g., purchase orders or inventory adjustments).

### 1. List Approval Workflows
Retrieve all approval workflow rules configured for the authenticated tenant.

*   **URL**: `/api/approvals/workflows`
*   **Method**: `GET`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Permission required: `approval:view`)
*   **Parameters**: None
*   **Success Response**: `200 OK`
    ```json
    [
      {
        "id": "wf_b8a90101-7b91-4e44-88aa-123456789abc",
        "tenantId": "tenant-1",
        "name": "High Value PO Approval",
        "triggerEvent": "PO_CREATED",
        "config": "{\"thresholds\":[{\"field\":\"totalAmount\",\"operator\":\">\",\"value\":10000}],\"steps\":[{\"approverRoles\":[\"finance_manager\"],\"requiredCount\":1,\"timeoutHours\":48}]}",
        "isActive": true,
        "createdAt": "2026-11-06T10:00:00.000Z",
        "updatedAt": "2026-11-06T10:00:00.000Z"
      }
    ]
    ```
*   **Error Responses**:
    *   `401 Unauthorized`: If the Bearer token is missing or invalid.
    *   `403 Forbidden`: If the user lacks the `approval:view` permission.
    *   `500 Internal Server Error`:
        ```json
        { "error": "Internal error message" }
        ```
*   **Workflow**: Used by administrative and finance consoles to review active and configured approval rules.

---

### 2. Create Approval Workflow
Define a new multi-tier approval rule based on event triggers, evaluation thresholds, and approver roles.

*   **URL**: `/api/approvals/workflows`
*   **Method**: `POST`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Permission required: `approval:manage`)
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Body**:
        *   `name` (string, Required): Descriptive name of the workflow.
        *   `triggerEvent` (string, Required): The event name that triggers evaluation (e.g. `"PO_CREATED"`).
        *   `config` (object or string, Required): Rule definition containing `thresholds` (array of conditions) and `steps` (array of approval steps with `approverRoles`, `requiredCount`, and `timeoutHours`).
        *   `isActive` (boolean, Optional): Whether the workflow is immediately active upon creation. Default is `true`.
*   **Request Body**:
    ```json
    {
      "name": "High Value PO Approval",
      "triggerEvent": "PO_CREATED",
      "config": {
        "thresholds": [
          { "field": "totalAmount", "operator": ">", "value": 10000 }
        ],
        "steps": [
          {
            "approverRoles": ["finance_manager"],
            "requiredCount": 1,
            "timeoutHours": 48
          }
        ]
      },
      "isActive": true
    }
    ```
*   **Success Response**: `201 Created`
    ```json
    {
      "id": "wf_b8a90101-7b91-4e44-88aa-123456789abc",
      "tenantId": "tenant-1",
      "name": "High Value PO Approval",
      "triggerEvent": "PO_CREATED",
      "config": "{\"thresholds\":[{\"field\":\"totalAmount\",\"operator\":\">\",\"value\":10000}],\"steps\":[{\"approverRoles\":[\"finance_manager\"],\"requiredCount\":1,\"timeoutHours\":48}]}",
      "isActive": true
    }
    ```
*   **Error Responses**:
    *   `400 Bad Request`: If validation fails or workflow definition is invalid.
        ```json
        { "error": "Approval workflow must define at least one approval step." }
        ```
    *   `401 Unauthorized`: If the Bearer token is missing or invalid.
    *   `403 Forbidden`: If the user lacks the `approval:manage` permission.
*   **Workflow**: Configures governance guardrails ensuring critical domain operations require human review before completion.

---

### 3. Update Workflow Configuration
Update the threshold and step configurations for an existing approval workflow.

*   **URL**: `/api/approvals/workflows/:id`
*   **Method**: `PUT`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Permission required: `approval:manage`)
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Path**:
        *   `id` (string, Required): The approval workflow identifier.
    *   **Body**:
        *   `config` (object or string, Required): Updated configuration object or stringified JSON containing `thresholds` and `steps`.
*   **Request Body**:
    ```json
    {
      "config": {
        "thresholds": [
          { "field": "totalAmount", "operator": ">=", "value": 15000 }
        ],
        "steps": [
          {
            "approverRoles": ["finance_director"],
            "requiredCount": 1,
            "timeoutHours": 72
          }
        ]
      }
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    {
      "id": "wf_b8a90101-7b91-4e44-88aa-123456789abc",
      "tenantId": "tenant-1",
      "name": "High Value PO Approval",
      "triggerEvent": "PO_CREATED",
      "config": "{\"thresholds\":[{\"field\":\"totalAmount\",\"operator\":\">=\",\"value\":15000}],\"steps\":[{\"approverRoles\":[\"finance_director\"],\"requiredCount\":1,\"timeoutHours\":72}]}",
      "isActive": true
    }
    ```
*   **Error Responses**:
    *   `400 Bad Request`: If the workflow ID is not found or configuration is invalid.
    *   `401 Unauthorized`: If the Bearer token is missing or invalid.
    *   `403 Forbidden`: If the user lacks the `approval:manage` permission.
*   **Workflow**: Modifies escalation tiers and decision thresholds without re-creating workflow entities.

---

### 4. Toggle Workflow Status
Enable or disable an approval workflow.

*   **URL**: `/api/approvals/workflows/:id/toggle`
*   **Method**: `POST`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Permission required: `approval:manage`)
*   **Parameters**:
    *   **Path**:
        *   `id` (string, Required): The approval workflow identifier.
*   **Success Response**: `200 OK`
    ```json
    {
      "id": "wf_b8a90101-7b91-4e44-88aa-123456789abc",
      "tenantId": "tenant-1",
      "name": "High Value PO Approval",
      "isActive": false
    }
    ```
*   **Error Responses**:
    *   `400 Bad Request`: If the workflow record does not exist.
        ```json
        { "error": "Workflow not found" }
        ```
    *   `401 Unauthorized`: If the Bearer token is missing or invalid.
    *   `403 Forbidden`: If the user lacks the `approval:manage` permission.
*   **Workflow**: Temporarily pauses or reactivates workflow enforcement during policy changes or emergency operations.

---

### 5. List Pending Approval Requests
List all pending approval requests awaiting sign-off for the authenticated tenant.

*   **URL**: `/api/approvals/pending`
*   **Method**: `GET`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Permission required: `approval:view`)
*   **Parameters**: None
*   **Success Response**: `200 OK`
    ```json
    [
      {
        "id": "req_550e8400-e29b-41d4-a716-446655440000",
        "tenantId": "tenant-1",
        "workflowId": "wf_b8a90101-7b91-4e44-88aa-123456789abc",
        "referenceType": "PURCHASE_ORDER",
        "referenceId": "po-123",
        "requesterId": "usr_ops_01",
        "status": "PENDING",
        "currentStep": 0,
        "payload": "{\"totalAmount\":12500}",
        "workflow": {
          "id": "wf_b8a90101-7b91-4e44-88aa-123456789abc",
          "name": "High Value PO Approval"
        },
        "decisions": []
      }
    ]
    ```
*   **Error Responses**:
    *   `401 Unauthorized`: If the Bearer token is missing or invalid.
    *   `403 Forbidden`: If the user lacks the `approval:view` permission.
    *   `500 Internal Server Error`: If fetching pending requests fails.
*   **Workflow**: Queried by manager dashboards and inbox views to present tasks waiting for review.

---

### 6. Get Approval Request by ID
Retrieve details and current decision history for a specific approval request.

*   **URL**: `/api/approvals/:id`
*   **Method**: `GET`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Permission required: `approval:view`)
*   **Parameters**:
    *   **Path**:
        *   `id` (string, Required): The approval request identifier.
*   **Success Response**: `200 OK`
    ```json
    {
      "id": "req_550e8400-e29b-41d4-a716-446655440000",
      "tenantId": "tenant-1",
      "workflowId": "wf_b8a90101-7b91-4e44-88aa-123456789abc",
      "referenceType": "PURCHASE_ORDER",
      "referenceId": "po-123",
      "requesterId": "usr_ops_01",
      "status": "PENDING",
      "currentStep": 0,
      "payload": "{\"totalAmount\":12500}",
      "workflow": {
        "id": "wf_b8a90101-7b91-4e44-88aa-123456789abc",
        "name": "High Value PO Approval"
      },
      "decisions": []
    }
    ```
*   **Error Responses**:
    *   `401 Unauthorized`: If the Bearer token is missing or invalid.
    *   `403 Forbidden`: If the user lacks the `approval:view` permission.
    *   `404 Not Found`: If the request record cannot be located.
        ```json
        { "error": "Not found" }
        ```
    *   `500 Internal Server Error`: If an unexpected database failure occurs.
*   **Workflow**: Loaded when opening an approval request detail modal or approval review page.

---

### 7. Submit Approval Decision
Record an approval decision (`APPROVE` or `REJECT`) on a pending approval request.

*   **URL**: `/api/approvals/:id/decide`
*   **Method**: `POST`
*   **Headers**:
    *   `Authorization: Bearer <token>` (Required, Permission required: `approval:manage`)
    *   `Content-Type: application/json` (Required)
*   **Parameters**:
    *   **Path**:
        *   `id` (string, Required): The approval request identifier.
    *   **Body**:
        *   `decision` (string, Required): Decision verdict (`"APPROVE"` or `"REJECT"`).
        *   `notes` (string, Optional): Explanatory reason or feedback from the reviewer.
*   **Request Body**:
    ```json
    {
      "decision": "APPROVE",
      "notes": "Budget verified and approved."
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    {
      "id": "dec_33112233-4455-6677-8899-aabbccddeeff",
      "requestId": "req_550e8400-e29b-41d4-a716-446655440000",
      "stepIndex": 0,
      "deciderId": "usr_mgr_01",
      "decision": "APPROVED",
      "notes": "Budget verified and approved.",
      "decidedAt": "2026-11-06T11:00:00.000Z"
    }
    ```
*   **Error Responses**:
    *   `400 Bad Request`: If the request is not pending, or decision submission fails.
        ```json
        { "error": "Approval request is not pending" }
        ```
    *   `401 Unauthorized`: If the Bearer token is missing or invalid.
    *   `403 Forbidden`: If the user lacks the `approval:manage` permission.
*   **Workflow**: Triggered when a manager or reviewer signs off or rejects a request, advancing multi-step chains or resolving blocked business events.
