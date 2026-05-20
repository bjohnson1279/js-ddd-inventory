# API Documentation

This document describes the available endpoints for the Retail Inventory System.

## Inventory Endpoints

### 1. Receive Stock
Adds stock for a specific SKU.

- **URL**: `/api/inventory/receive`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Body**:
  ```json
  {
    "sku": "IPHONE-15-PRO-BLK",
    "amount": 50
  }
  ```
- **Success Response**: `200 OK`
  ```json
  { "message": "Stock received successfully" }
  ```

### 2. Dispatch Stock
Deducts stock for a specific SKU.

- **URL**: `/api/inventory/dispatch`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Body**:
  ```json
  {
    "sku": "IPHONE-15-PRO-BLK",
    "amount": 5
  }
  ```
- **Success Response**: `200 OK`
  ```json
  { "message": "Stock dispatched successfully" }
  ```

### 3. Get Stock Level
Retrieves the current stock level for a SKU.

- **URL**: `/api/inventory/level/:sku`
- **Method**: `GET`
- **Example**: `/api/inventory/level/IPHONE-15-PRO-BLK`
- **Success Response**: `200 OK`
  ```json
  {
    "sku": "IPHONE-15-PRO-BLK",
    "quantity": 45
  }
  ```

### 4. Perform Full Store Count
Reconciles the inventory with a full physical count.

- **URL**: `/api/inventory/count`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Body**:
  ```json
  {
    "counts": [
      { "sku": "IPHONE-15-PRO-BLK", "amount": 42 },
      { "sku": "IPHONE-15-PRO-WHT", "amount": 10 }
    ]
  }
  ```
- **Success Response**: `200 OK`
  ```json
  { "message": "Store count performed successfully" }
  ```

---

## Shopify Webhook Endpoints

These endpoints are designed to be called by Shopify webhooks.

### 1. Order Created Webhook
Automatically deducts stock when a new order is created in Shopify.

- **URL**: `/api/shopify/webhooks/orders/create`
- **Method**: `POST`
- **Headers**:
  - `X-Shopify-Hmac-Sha256`: (Required for security validation)
  - `X-Shopify-Topic`: `orders/create`
- **Body**: (Shopify Order Webhook Payload)
  ```json
  {
    "line_items": [
      {
        "sku": "IPHONE-15-PRO-BLK",
        "quantity": 1
      }
    ]
  }
  ```
- **Success Response**: `200 OK` - "Webhook processed"
- **Error Responses**:
  - `401 Unauthorized`: Missing or invalid HMAC signature.
  - `400 Bad Request`: Unsupported topic.
