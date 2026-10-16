const fs = require('fs');

const testFiles = [
  'tests/infrastructure/http/E2E.test.ts',
  'tests/infrastructure/http/WarehouseLocationE2E.test.ts',
  'tests/infrastructure/http/ForecastingE2E.test.ts',
  'tests/infrastructure/http/AuthE2E.test.ts',
  'tests/infrastructure/http/RMAE2E.test.ts',
  'tests/infrastructure/http/AllocationsE2E.test.ts',
  'tests/infrastructure/http/ShippingCarrierE2E.test.ts',
  'tests/infrastructure/http/FefoRecallE2E.test.ts',
  'tests/infrastructure/database/TenantRegistry.test.ts',
  'tests/infrastructure/http/InventoryAuditE2E.test.ts',
  'tests/infrastructure/http/OutboxE2E.test.ts',
  'tests/infrastructure/http/AuditE2E.test.ts',
  'tests/infrastructure/http/PurchaseOrderE2E.test.ts',
  'tests/infrastructure/http/ReorderPolicyE2E.test.ts',
  'tests/infrastructure/workers/WebhookDeliveryWorker.test.ts',
  'tests/infrastructure/http/ComplianceE2E.test.ts',
  'tests/infrastructure/http/ApprovalE2E.test.ts',
];

for (const file of testFiles) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('process.env.ENCRYPTION_KEY =')) {
      content = 'process.env.ENCRYPTION_KEY = "test_encryption_key";\n' + content;
      fs.writeFileSync(file, content, 'utf8');
    }
  }
}
