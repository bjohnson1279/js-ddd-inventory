-- CreateTable
CREATE TABLE "InventoryModel" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "locationId" TEXT NOT NULL DEFAULT 'default',
    "quantity" INTEGER NOT NULL,
    "allocated" INTEGER NOT NULL DEFAULT 0,
    "inTransit" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InventoryModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarcodeAssignmentModel" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "barcodeValue" TEXT NOT NULL,
    "symbology" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarcodeAssignmentModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ProductModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariantModel" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "attributes" TEXT NOT NULL,
    "weightGrams" INTEGER,
    "volumeCubicMeters" DOUBLE PRECISION,

    CONSTRAINT "ProductVariantModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerializedItemModel" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SerializedItemModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusTransitionModel" (
    "id" TEXT NOT NULL,
    "serializedItemId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "transitionedAt" TIMESTAMP(3) NOT NULL,
    "actorId" TEXT NOT NULL,
    "referenceId" TEXT,

    CONSTRAINT "StatusTransitionModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitModel" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "KitModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitComponentModel" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "KitComponentModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCostLayerModel" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "locationId" TEXT,
    "tenantId" TEXT NOT NULL,
    "originalQuantity" INTEGER NOT NULL,
    "remainingQuantity" INTEGER NOT NULL,
    "unitCostCents" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "isConsumed" BOOLEAN NOT NULL DEFAULT false,
    "lotNumber" TEXT,
    "expirationDate" TIMESTAMP(3),

    CONSTRAINT "InventoryCostLayerModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntryModel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "accountingMethod" TEXT NOT NULL,

    CONSTRAINT "JournalEntryModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLineModel" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountCategory" TEXT NOT NULL,
    "debitOrCredit" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "memo" TEXT,

    CONSTRAINT "JournalLineModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantConfigModel" (
    "tenantId" TEXT NOT NULL,
    "accountingMethod" TEXT NOT NULL,
    "costingMethod" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "fiscalYearStart" TEXT NOT NULL,

    CONSTRAINT "TenantConfigModel_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "ProcessedWebhookModel" (
    "id" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEventModel" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "occurredOn" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEventModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "target_url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "event_types" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderModel" (
    "id" TEXT NOT NULL,
    "purchaseOrderNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItemModel" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitCostCents" INTEGER NOT NULL,

    CONSTRAINT "PurchaseOrderItemModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReorderPolicyModel" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "reorderPoint" INTEGER NOT NULL,
    "reorderQuantity" INTEGER NOT NULL,
    "safetyStock" INTEGER NOT NULL,
    "dynamic_rop_enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReorderPolicyModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAuditModel" (
    "id" TEXT NOT NULL,
    "auditNumber" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryAuditModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAuditItemModel" (
    "id" TEXT NOT NULL,
    "inventoryAuditId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "expectedQuantity" INTEGER NOT NULL,
    "countedQuantity" INTEGER,
    "isCounted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InventoryAuditItemModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RMAModel" (
    "id" TEXT NOT NULL,
    "rmaNumber" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RMAModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RMAItemModel" (
    "id" TEXT NOT NULL,
    "rmaId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitCostCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "disposition" TEXT,

    CONSTRAINT "RMAItemModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuarantineItemModel" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "QuarantineItemModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_records" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "dispatched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lotNumber" TEXT,

    CONSTRAINT "dispatch_records_pkey" PRIMARY KEY ("id","dispatched_at")
);

-- CreateTable
CREATE TABLE "DemandForecastModel" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "forecastedQuantity" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "confidenceLevel" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandForecastModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentModel" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "labelUrl" TEXT,
    "shippingRateCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserModel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "tenant_id" TEXT,

    CONSTRAINT "RoleModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoleModel" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRoleModel_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermissionModel" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermissionModel_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "ApiTokenModel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiTokenModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseLocationModel" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "aisle" TEXT NOT NULL,
    "rack" TEXT NOT NULL,
    "shelf" TEXT NOT NULL,
    "bin" TEXT NOT NULL,
    "maxWeightGrams" INTEGER NOT NULL,
    "maxVolumeCubicMeters" DOUBLE PRECISION NOT NULL,
    "gridX" INTEGER NOT NULL DEFAULT 0,
    "gridY" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 1,
    "height" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseLocationModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationModel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetsuiteJournalMappingModel" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "netsuiteJournalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetsuiteJournalMappingModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XeroJournalMappingModel" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "xeroJournalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XeroJournalMappingModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickbooksJournalMappingModel" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "quickbooksJournalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuickbooksJournalMappingModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_discrepancies" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "external_ref_id" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,

    CONSTRAINT "audit_discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceLedgerModel" (
    "id" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,

    CONSTRAINT "ComplianceLedgerModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfid_tags" (
    "epc" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TIMESTAMPTZ,
    "last_location" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfid_tags_pkey" PRIMARY KEY ("epc")
);

-- CreateTable
CREATE TABLE "lot_batches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lot_number" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "manufactured_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "supplier_id" TEXT,
    "quarantined_at" TIMESTAMP(3),
    "quarantine_reason" TEXT,
    "recalled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills_of_lading" (
    "id" TEXT NOT NULL,
    "bol_number" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "origin_address" TEXT NOT NULL,
    "destination_address" TEXT NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "total_packages" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bills_of_lading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_merchandise_authorizations" (
    "id" TEXT NOT NULL,
    "rma_number" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_INSPECTION',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_merchandise_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rma_items" (
    "id" TEXT NOT NULL,
    "rma_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "disposition" TEXT NOT NULL DEFAULT 'PENDING',
    "inspected_at" TIMESTAMP(3),

    CONSTRAINT "rma_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_asns" (
    "id" TEXT NOT NULL,
    "asn_number" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "expected_delivery" TIMESTAMP(3) NOT NULL,
    "actual_delivery" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'IN_TRANSIT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_asns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_scorecards" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "on_time_rate" DOUBLE PRECISION NOT NULL,
    "in_full_rate" DOUBLE PRECISION NOT NULL,
    "defect_rate" DOUBLE PRECISION NOT NULL,
    "otif_score" DOUBLE PRECISION NOT NULL,
    "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_scorecards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esg_emissions_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transport_mode" TEXT NOT NULL,
    "distance_km" DOUBLE PRECISION NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "ton_km" DOUBLE PRECISION NOT NULL,
    "co2e_kg" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "esg_emissions_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_definitions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "grouping" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" TEXT NOT NULL,
    "report_definition_id" TEXT NOT NULL,
    "cron_expression" TEXT NOT NULL,
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "last_run_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "delivery_method" TEXT NOT NULL DEFAULT 'INTERNAL',

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_executions" (
    "id" TEXT NOT NULL,
    "report_definition_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "file_url" TEXT,
    "format" TEXT NOT NULL,
    "error" TEXT,

    CONSTRAINT "report_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_report_links" (
    "id" TEXT NOT NULL,
    "report_execution_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "viewer_permissions" TEXT,

    CONSTRAINT "shared_report_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_widgets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "layout_x" INTEGER NOT NULL DEFAULT 0,
    "layout_y" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 1,
    "height" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_event" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_decisions" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "decider_id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_count_plans" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abc_classification" TEXT NOT NULL,
    "frequency_days" INTEGER NOT NULL,
    "zone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycle_count_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryModel_sku_locationId_key" ON "InventoryModel"("sku", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "BarcodeAssignmentModel_barcodeValue_key" ON "BarcodeAssignmentModel"("barcodeValue");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantModel_sku_key" ON "ProductVariantModel"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "SerializedItemModel_serialNumber_tenantId_key" ON "SerializedItemModel"("serialNumber", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "KitModel_sku_key" ON "KitModel"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderModel_purchaseOrderNumber_key" ON "PurchaseOrderModel"("purchaseOrderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReorderPolicyModel_sku_locationId_key" ON "ReorderPolicyModel"("sku", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAuditModel_auditNumber_key" ON "InventoryAuditModel"("auditNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RMAModel_rmaNumber_key" ON "RMAModel"("rmaNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DemandForecastModel_sku_locationId_periodStart_periodEnd_key" ON "DemandForecastModel"("sku", "locationId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "UserModel_tenantId_email_key" ON "UserModel"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "ApiTokenModel_tokenHash_key" ON "ApiTokenModel"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocationModel_warehouseId_zone_aisle_rack_shelf_bi_key" ON "WarehouseLocationModel"("warehouseId", "zone", "aisle", "rack", "shelf", "bin");

-- CreateIndex
CREATE UNIQUE INDEX "NetsuiteJournalMappingModel_journalEntryId_key" ON "NetsuiteJournalMappingModel"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "NetsuiteJournalMappingModel_netsuiteJournalId_key" ON "NetsuiteJournalMappingModel"("netsuiteJournalId");

-- CreateIndex
CREATE UNIQUE INDEX "XeroJournalMappingModel_journalEntryId_key" ON "XeroJournalMappingModel"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "XeroJournalMappingModel_xeroJournalId_key" ON "XeroJournalMappingModel"("xeroJournalId");

-- CreateIndex
CREATE UNIQUE INDEX "QuickbooksJournalMappingModel_journalEntryId_key" ON "QuickbooksJournalMappingModel"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "QuickbooksJournalMappingModel_quickbooksJournalId_key" ON "QuickbooksJournalMappingModel"("quickbooksJournalId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceLedgerModel_sequenceNumber_key" ON "ComplianceLedgerModel"("sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "lot_batches_tenant_id_lot_number_variant_id_key" ON "lot_batches"("tenant_id", "lot_number", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "bills_of_lading_bol_number_key" ON "bills_of_lading"("bol_number");

-- CreateIndex
CREATE UNIQUE INDEX "return_merchandise_authorizations_rma_number_key" ON "return_merchandise_authorizations"("rma_number");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_asns_asn_number_key" ON "supplier_asns"("asn_number");

-- CreateIndex
CREATE UNIQUE INDEX "shared_report_links_token_key" ON "shared_report_links"("token");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_channel_event_type_key" ON "notification_preferences"("user_id", "channel", "event_type");

-- AddForeignKey
ALTER TABLE "ProductVariantModel" ADD CONSTRAINT "ProductVariantModel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProductModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusTransitionModel" ADD CONSTRAINT "StatusTransitionModel_serializedItemId_fkey" FOREIGN KEY ("serializedItemId") REFERENCES "SerializedItemModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitComponentModel" ADD CONSTRAINT "KitComponentModel_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "KitModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLineModel" ADD CONSTRAINT "JournalLineModel_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntryModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItemModel" ADD CONSTRAINT "PurchaseOrderItemModel_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrderModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAuditItemModel" ADD CONSTRAINT "InventoryAuditItemModel_inventoryAuditId_fkey" FOREIGN KEY ("inventoryAuditId") REFERENCES "InventoryAuditModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RMAItemModel" ADD CONSTRAINT "RMAItemModel_rmaId_fkey" FOREIGN KEY ("rmaId") REFERENCES "RMAModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModel" ADD CONSTRAINT "UserModel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "TenantModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleModel" ADD CONSTRAINT "RoleModel_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "TenantModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleModel" ADD CONSTRAINT "UserRoleModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleModel" ADD CONSTRAINT "UserRoleModel_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "RoleModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermissionModel" ADD CONSTRAINT "RolePermissionModel_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "RoleModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermissionModel" ADD CONSTRAINT "RolePermissionModel_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiTokenModel" ADD CONSTRAINT "ApiTokenModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rma_items" ADD CONSTRAINT "rma_items_rma_id_fkey" FOREIGN KEY ("rma_id") REFERENCES "return_merchandise_authorizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_report_definition_id_fkey" FOREIGN KEY ("report_definition_id") REFERENCES "report_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_report_definition_id_fkey" FOREIGN KEY ("report_definition_id") REFERENCES "report_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_report_links" ADD CONSTRAINT "shared_report_links_report_execution_id_fkey" FOREIGN KEY ("report_execution_id") REFERENCES "report_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "approval_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
