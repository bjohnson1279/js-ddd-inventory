# Retail Inventory System (DDD) — REST API Documentation

This document describes the complete set of HTTP endpoints available in the Node.js / Express inventory application, organized by bounded context.

---

## 🔐 Authentication & Users

### 1. Register / Organization Setup
Initialize organization details and register the root admin user.
*   **URL**: `/api/auth/setup`
*   **Method**: `POST`
*   **Body**:
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
    { "message": "Organization and admin account set up successfully." }
    ```

### 2. User Login
Authenticate credentials to receive a JSON Web Token (JWT).
*   **URL**: `/api/auth/login`
*   **Method**: `POST`
*   **Body**:
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

### 3. List Users
Retrieve all registered users (Admin role required).
*   **URL**: `/api/users`
*   **Method**: `GET`
*   **Headers**: `Authorization: Bearer <token>`
*   **Success Response**: `200 OK`

### 4. Invite User
Invite a new member to the organization (Admin role required).
*   **URL**: `/api/users`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body**:
    ```json
    {
      "email": "staff@example.com",
      "role": "warehouse_operator"
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    {
      "userId": "usr_...",
      "temporaryPassword": "temp-password-abc"
    }
    ```

### 5. Update User Role
Modify user permissions/role (Admin role required).
*   **URL**: `/api/users/:userId/role`
*   **Method**: `PATCH`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body**: `{ "role": "accountant" }`
*   **Success Response**: `200 OK`

---

## 📦 Inventory Management

### 1. List Inventory Items
*   **URL**: `/api/inventory`
*   **Method**: `GET`

### 2. Receive Stock
*   **URL**: `/api/inventory/receive`
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "sku": "IPHONE-15-PRO-BLK",
      "amount": 50,
      "locationId": "LOC-A1"
    }
    ```

### 3. Dispatch Stock
*   **URL**: `/api/inventory/dispatch`
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "sku": "IPHONE-15-PRO-BLK",
      "amount": 5,
      "locationId": "LOC-A1"
    }
    ```

### 4. Allocate Stock (Committed to order)
*   **URL**: `/api/inventory/allocate`
*   **Method**: `POST`
*   **Headers**: Role required: `admin`, `warehouse_operator`
*   **Body**: `{ "sku": "IPHONE-15-PRO-BLK", "amount": 2, "locationId": "LOC-A1" }`

### 5. Release / Fulfill Allocation
*   **URL**: `/api/inventory/release-allocation` or `/api/inventory/fulfill-allocation`
*   **Method**: `POST`

### 6. Create / Receive Stock In-Transit
*   **URL**: `/api/inventory/create-in-transit` or `/api/inventory/receive-in-transit`
*   **Method**: `POST`

---

## 📝 Physical Audits & Cycle Counts

### 1. Create Count Session
*   **URL**: `/api/inventory-audit`
*   **Method**: `POST`

### 2. Start Count Session
*   **URL**: `/api/inventory-audit/:id/start`
*   **Method**: `POST`

### 3. Record Count Item
*   **URL**: `/api/inventory-audit/:id/count`
*   **Method**: `POST`
*   **Body**: `{ "sku": "IPHONE-15-PRO-BLK", "quantity": 42 }`

### 4. Complete & Reconcile
*   **URL**: `/api/inventory-audit/:id/complete` or `/api/inventory-audit/:id/reconcile`
*   **Method**: `POST`

---

## 🧾 Accrual & Cash Accounting

### 1. Get Journal Ledger
*   **URL**: `/api/accounting/ledger`
*   **Method**: `GET`

### 2. Calculate Stock Valuation (FIFO/LIFO Cost Layers)
*   **URL**: `/api/accounting/valuation/:variantId`
*   **Method**: `GET`

---

## 🏷️ Barcodes, Serial Tracking & RMA Returns

### 1. Assign Barcode to SKU
*   **URL**: `/api/barcode/assign`
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "sku": "IPHONE-15-PRO-BLK",
      "barcodeValue": "012345678901",
      "symbology": "upc_a",
      "source": "supplier",
      "makePrimary": true
    }
    ```

### 2. Register Serialized Item
*   **URL**: `/api/serial/register`
*   **Method**: `POST`
    ```json
    {
      "variantId": "var_1",
      "serialNumber": "SN-987654",
      "locationId": "LOC-A1"
    }
    ```

### 3. Create / Receive RMA Return
*   **URL**: `/api/rma` or `/api/rma/:id/receive`
*   **Method**: `POST`

### 4. Resolve Quarantine Item
*   **URL**: `/api/quarantine/:id/resolve`
*   **Method**: `POST`
    ```json
    {
      "resolution": "RESTOCKED" // or SCRAPPED / RTV
    }
    ```

---

## 🛠️ Kits & Bundles

*   **Create Kit**: `POST /api/kit/create` (defines kit SKU and component ratios)
*   **Sell Kit**: `POST /api/kit/dispatch` (deducts components proportionally)
*   **Assemble Kit**: `POST /api/kit/assemble` (increases kit stock, depletes components)
*   **Disassemble Kit**: `POST /api/kit/disassemble` (depletes kit stock, increases components)

---

## 📈 Demand Forecasting & Shipping

### 1. Generate Demand Forecast
*   **URL**: `/api/forecasting/forecast`
*   **Method**: `POST`
*   **Body**: `{ "sku": "IPHONE-15-PRO-BLK", "locationId": "LOC-A1", "forecastDays": 30, "trendMultiplier": 1.1 }`

### 2. Fetch Planning Report
*   **URL**: `/api/forecasting/report`
*   **Method**: `GET`

### 3. Rate Shopping (Carrier Shipping Integration)
*   **URL**: `/api/shipping/rates`
*   **Method**: `GET`

### 4. Purchase Shipping Label & Track
*   **URL**: `/api/shipping/labels` (POST) or `/api/shipping/shipments/:id/track` (POST)

---

## 🐳 Integrations & Outbox

*   **Shopify Order Webhook**: `POST /api/shopify/webhooks/orders/create`
*   **Outbox Event Log Status**: `GET /api/outbox/stats`
*   **Retry Dead-Lettered Messages**: `POST /api/outbox/:id/retry`

---

## 🔒 Compliance Ledger (Audit Trails)

### 1. Fetch Compliance Audit Logs
*   **URL**: `/api/compliance/ledger`
*   **Method**: `GET`
*   **Query**: `?tenantId=tenant-1` (Optional)
*   **Success Response**: `200 OK` (Array of cryptographically signed block entries in reverse chronological order)

### 2. Verify Ledger Integrity
*   **URL**: `/api/compliance/verify`
*   **Method**: `POST`
*   **Query**: `?tenantId=tenant-1` (Optional)
*   **Success Response**: `200 OK`
    ```json
    { "isValid": true }
    ```
