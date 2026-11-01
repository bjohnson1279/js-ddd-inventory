# Retail Inventory System (DDD) — REST API Documentation

This document describes the complete set of HTTP endpoints available in the Node.js / Fastify inventory application, organized by bounded context.

---

## 🔐 Authentication & Users

### 1. Register / Organization Setup
Initialize organization details and register the root admin user.
*   **URL**: `/api/auth/setup`
*   **Method**: `POST`
*   **Rate Limit**: 10 requests / 15 minutes
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
*   **Rate Limit**: 5 requests / 15 minutes
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
*   **Headers**: Role required: `admin`, `warehouse_operator`

### 6. Create / Receive Stock In-Transit
*   **URL**: `/api/inventory/create-in-transit` or `/api/inventory/receive-in-transit`
*   **Method**: `POST`
*   **Headers**: Role required: `admin`, `warehouse_operator`

---

## 📝 Physical Audits & Cycle Counts

### 1. Create Count Session
*   **URL**: `/api/audits`
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "tenantId": "tenant-1",
      "locationId": "LOC-A1",
      "scheduledDate": "2026-03-01T00:00:00.000Z"
    }
    ```

### 2. Start Count Session
*   **URL**: `/api/audits/:id/start`
*   **Method**: `POST`

### 3. Record Count Item
*   **URL**: `/api/audits/:id/count`
*   **Method**: `POST`
*   **Body**: `{ "sku": "IPHONE-15-PRO-BLK", "quantity": 42 }`

### 4. Complete & Reconcile
*   **URL**: `/api/audits/:id/complete` or `/api/audits/:id/reconcile`
*   **Method**: `POST`

---

## 🏷️ Lots, Batch Management & Traceability

### 1. Quarantine Lot Batch
Place a specific lot batch under quarantine (Role required: `admin`, `warehouse_operator`).
*   **URL**: `/api/lots/quarantine`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body**:
    ```json
    {
      "lotNumber": "LOT-2026-001",
      "variantId": "VAR-SKU-100",
      "reason": "Suspected packaging seal integrity failure"
    }
    ```
*   **Success Response**: `200 OK`

### 2. Issue Lot Recall
Mark a lot batch as recalled across all downstream distributions (Role required: `admin`).
*   **URL**: `/api/lots/recall`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body**:
    ```json
    {
      "lotNumber": "LOT-2026-001",
      "variantId": "VAR-SKU-100",
      "reason": "Critical component supplier recall advisory"
    }
    ```
*   **Success Response**: `200 OK`

### 3. Release Quarantined Lot
Restore an inspected lot back to ACTIVE status (Role required: `admin`, `warehouse_operator`).
*   **URL**: `/api/lots/release`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body**:
    ```json
    {
      "lotNumber": "LOT-2026-001",
      "variantId": "VAR-SKU-100"
    }
    ```
*   **Success Response**: `200 OK`

### 4. Lot Traceability Report
Retrieve end-to-end forward and backward genealogy for a lot, including supplier cost layers and customer outbound shipments (Role required: `admin`, `warehouse_operator`, `viewer`, `accountant`).
*   **URL**: `/api/lots/:lotNumber/traceability`
*   **Method**: `GET`
*   **Headers**: `Authorization: Bearer <token>`
*   **Query Parameters**:
    *   `variantId` (string, required): The SKU or variant ID associated with the lot.
*   **Success Response**: `200 OK`
    ```json
    {
      "lotNumber": "LOT-2026-001",
      "variantId": "VAR-SKU-100",
      "status": "ACTIVE",
      "costLayers": [],
      "affectedShipments": []
    }
    ```

---

## 🔀 Cross-Docking & Drop-Shipping

### 1. Cross-Dock Evaluation
Evaluate inbound purchase order items against active backorders to optimize direct cross-dock transfers without putaway (Role required: `admin`, `warehouse_operator`).
*   **URL**: `/api/cross-dock/evaluate`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body**:
    ```json
    {
      "purchaseOrderId": "PO-9001",
      "inboundItems": [
        { "sku": "IPHONE-15-PRO-BLK", "quantity": 20 }
      ],
      "backorders": [
        { "orderId": "ORD-501", "sku": "IPHONE-15-PRO-BLK", "quantity": 10 }
      ]
    }
    ```
*   **Success Response**: `200 OK`

### 2. Drop-Ship Fulfillment Order
Dispatch drop-ship purchase orders directly from a vendor to customer (Role required: `admin`, `warehouse_operator`).
*   **URL**: `/api/fulfillment/drop-ship`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body**:
    ```json
    {
      "orderId": "ORD-8821",
      "variantId": "VAR-SKU-100",
      "quantity": 5,
      "supplierId": "SUP-101"
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    {
      "status": "SUCCESS",
      "dropShipPoId": "c4b3a1...",
      "orderId": "ORD-8821",
      "variantId": "VAR-SKU-100",
      "quantity": 5,
      "supplierId": "SUP-101",
      "createdAt": "2026-03-01T12:00:00.000Z"
    }
    ```

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
*   **URL**: `/api/barcodes/assign`
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
*   **URL**: `/api/serials/register`
*   **Method**: `POST`
    ```json
    {
      "variantId": "var_1",
      "serialNumber": "SN-987654",
      "locationId": "LOC-A1"
    }
    ```

### 3. Create / Receive RMA Return
*   **URL**: `/api/returns/rma` or `/api/returns/rma/:id/receive`
*   **Method**: `POST`
*   **Headers**: Role required: `admin`, `warehouse_operator`

### 4. Inspect RMA Item
Inspect returned units and record physical disposition.
*   **URL**: `/api/rma/inspect`
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "rmaNumber": "RMA-2026-01",
      "sku": "IPHONE-15-PRO-BLK",
      "disposition": "RESTOCK",
      "notes": "Original unopened packaging verified"
    }
    ```
*   **Success Response**: `200 OK`

### 5. Resolve Quarantine Item
*   **URL**: `/api/returns/quarantine/:id/resolve`
*   **Method**: `POST`
*   **Headers**: Role required: `admin`, `warehouse_operator`
*   **Body**:
    ```json
    {
      "resolution": "RESTOCKED"
    }
    ```

---

## 🛠️ Kits & Bundles

*   **Create Kit**: `POST /api/kits/create` (defines kit SKU and component ratios)
*   **Sell Kit**: `POST /api/kits/dispatch` (deducts components proportionally)
*   **Assemble Kit**: `POST /api/kits/assemble` (increases kit stock, depletes components)
*   **Disassemble Kit**: `POST /api/kits/disassemble` (depletes kit stock, increases components)

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

### 5. Generate Bill of Lading (BOL)
Generate freight Bill of Lading document in PDF (Base64) format.
*   **URL**: `/api/shipping/bol`
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "carrier": "FEDEX",
      "originAddress": "Warehouse A, Austin TX",
      "destinationAddress": "Distribution Center, Chicago IL",
      "weightKg": 150.5,
      "totalPackages": 4
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    {
      "bolNumber": "BOL-582914",
      "carrier": "FEDEX",
      "status": "GENERATED",
      "pdfBase64": "..."
    }
    ```

---

## ⚙️ Enterprise Logistics & Hardware Operations

### 1. Thermal Label Printing (ZPL)
Generate and queue sanitized ZPL barcode thermal label payloads.
*   **URL**: `/api/hardware/print-thermal`
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "printerName": "Zebra-ZT411",
      "labelType": "LOCATION",
      "barcodeValue": "LOC-A1-B04",
      "subtitle": "Bin Location Aisle 1"
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    {
      "success": true,
      "jobId": "PRINT-JOB-8492",
      "printerName": "Zebra-ZT411",
      "zplCode": "^XA...",
      "sentAt": "2026-03-01T12:00:00.000Z"
    }
    ```

### 2. Digital Twin Warehouse Simulation
Simulate picker movement, wave processing, and identify warehouse bottleneck bins.
*   **URL**: `/api/digital-twin/simulate`
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "orderWaveCount": 10,
      "activePickersCount": 5
    }
    ```
*   **Success Response**: `200 OK`
    ```json
    {
      "scenarioId": "SIM-4912",
      "durationSeconds": 3600,
      "totalOrdersProcessed": 250,
      "averageFulfillmentTimeMinutes": 12.5,
      "bottleneckBinId": "BIN-B-104",
      "throughputPerHour": 125,
      "pickerUtilizationRate": 0.88,
      "congestionHotspots": ["Aisle 2 - High Velocity Rack", "Dispatch Dock B"]
    }
    ```

### 3. Inventory AI Copilot Query
Natural language query interface for stockout risk and replenishment analytics.
*   **URL**: `/api/copilot/query`
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "query": "What is the stockout risk for high velocity SKUs?"
    }
    ```
*   **Success Response**: `200 OK`

### 4. Sustainability & Carbon Emissions Report
Retrieve fleet and warehouse GHG emissions calculations (Scope 1/2/3).
*   **URL**: `/api/sustainability/emissions-report`
*   **Method**: `GET`
*   **Query Parameters**:
    *   `tenantId` (string, optional, default: `tenant-1`)
*   **Success Response**: `200 OK`
    ```json
    {
      "tenantId": "tenant-1",
      "period": "2026-Q3",
      "transportEmissionsCo2eKg": 12450.8,
      "facilityEmissionsCo2eKg": 3820.4,
      "totalEmissionsCo2eKg": 16271.2,
      "emissionsIntensityPerOrder": 2.34
    }
    ```

### 5. Supplier OTIF Scorecard
Evaluate supplier On-Time In-Full performance metrics.
*   **URL**: `/api/supplier/otif-scorecard`
*   **Method**: `GET`
*   **Query Parameters**:
    *   `supplierId` (string, optional, default: `SUP-101`)
*   **Success Response**: `200 OK`
    ```json
    {
      "supplierId": "SUP-101",
      "onTimeRate": 94.5,
      "inFullRate": 98.2,
      "defectRate": 0.8,
      "otifScore": 92.8,
      "totalShipments": 142
    }
    ```

### 6. ERP Multi-Ledger Journal Sync
Post external journal lines directly into configured ERP systems (QuickBooks, NetSuite, Xero).
*   **URL**: `/api/erp/sync`
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "provider": "QUICKBOOKS",
      "referenceId": "REF-10023",
      "lines": [
        { "accountId": "ACC-101", "amountCents": 5000, "description": "Inventory Asset" }
      ]
    }
    ```
*   **Success Response**: `200 OK`

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
*   **Headers**: `Authorization: Bearer <token>` (Admin role required)
*   **Query Parameters**:
    *   `tenantId` (string, optional, default: `tenant-1`)
*   **Success Response**: `200 OK` (Array of cryptographically signed block entries in reverse chronological order)

### 2. Verify Ledger Integrity
*   **URL**: `/api/compliance/verify`
*   **Method**: `POST`
*   **Headers**: `Authorization: Bearer <token>` (Admin role required)
*   **Query Parameters**:
    *   `tenantId` (string, optional, default: `tenant-1`)
*   **Success Response**: `200 OK`
    ```json
    { "isValid": true }
    ```
