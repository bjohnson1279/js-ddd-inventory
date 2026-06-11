import { InventoryAudit } from "../../../src/domain/procurement/aggregates/InventoryAudit";
import { InventoryAuditItem } from "../../../src/domain/procurement/aggregates/InventoryAuditItem";
import { AuditStatus } from "../../../src/domain/procurement/enums/AuditStatus";

describe("InventoryAudit Aggregate", () => {
  it("should initialize in DRAFT status and contain provided items", () => {
    const item1 = new InventoryAuditItem("item-1", "VAR-A", 10);
    const item2 = new InventoryAuditItem("item-2", "VAR-B", 5);

    const audit = new InventoryAudit("audit-1", "AUD-001", "TEN-1", "loc-1", AuditStatus.Draft, [item1, item2]);

    expect(audit.status).toBe(AuditStatus.Draft);
    expect(audit.items.length).toBe(2);
    expect(audit.items[0].variantId).toBe("VAR-A");
    expect(audit.items[0].expectedQuantity).toBe(10);
    expect(audit.items[0].countedQuantity).toBeNull();
    expect(audit.items[0].isCounted).toBe(false);
  });

  it("should transition Draft to InProgress on start()", () => {
    const audit = new InventoryAudit("audit-1", "AUD-001", "TEN-1", "loc-1", AuditStatus.Draft, []);
    audit.start();
    expect(audit.status).toBe(AuditStatus.InProgress);
  });

  it("should throw when starting an audit that is not Draft", () => {
    const audit = new InventoryAudit("audit-1", "AUD-001", "TEN-1", "loc-1", AuditStatus.InProgress, []);
    expect(() => audit.start()).toThrow(/Only draft audits can be started/i);
  });

  it("should record count only when InProgress", () => {
    const item = new InventoryAuditItem("item-1", "VAR-A", 10);
    const audit = new InventoryAudit("audit-1", "AUD-001", "TEN-1", "loc-1", AuditStatus.InProgress, [item]);

    audit.recordCount("VAR-A", 8);

    expect(audit.items[0].countedQuantity).toBe(8);
    expect(audit.items[0].isCounted).toBe(true);
    expect(audit.items[0].discrepancy).toBe(-2); // shrinkage
  });

  it("should throw when recording count and audit is not InProgress", () => {
    const item = new InventoryAuditItem("item-1", "VAR-A", 10);
    const audit = new InventoryAudit("audit-1", "AUD-001", "TEN-1", "loc-1", AuditStatus.Draft, [item]);

    expect(() => audit.recordCount("VAR-A", 8)).toThrow(/Can only record counts on in-progress audits/i);
  });

  it("should throw if variant ID to count is not in audit items", () => {
    const item = new InventoryAuditItem("item-1", "VAR-A", 10);
    const audit = new InventoryAudit("audit-1", "AUD-001", "TEN-1", "loc-1", AuditStatus.InProgress, [item]);

    expect(() => audit.recordCount("VAR-B", 8)).toThrow(/not found in this audit/i);
  });

  it("should complete audit when all items are counted", () => {
    const item = new InventoryAuditItem("item-1", "VAR-A", 10);
    const audit = new InventoryAudit("audit-1", "AUD-001", "TEN-1", "loc-1", AuditStatus.InProgress, [item]);

    audit.recordCount("VAR-A", 12);
    audit.complete();

    expect(audit.status).toBe(AuditStatus.Completed);
    expect(audit.items[0].discrepancy).toBe(2); // gain
  });

  it("should throw on complete() if some items are not counted", () => {
    const item1 = new InventoryAuditItem("item-1", "VAR-A", 10);
    const item2 = new InventoryAuditItem("item-2", "VAR-B", 5);
    const audit = new InventoryAudit("audit-1", "AUD-001", "TEN-1", "loc-1", AuditStatus.InProgress, [item1, item2]);

    audit.recordCount("VAR-A", 10);

    expect(() => audit.complete()).toThrow(/some items have not been counted/i);
  });

  it("should reconcile completed audits", () => {
    const audit = new InventoryAudit("audit-1", "AUD-001", "TEN-1", "loc-1", AuditStatus.Completed, []);
    audit.reconcile();
    expect(audit.status).toBe(AuditStatus.Reconciled);
  });

  it("should throw on reconcile() if not completed", () => {
    const audit = new InventoryAudit("audit-1", "AUD-001", "TEN-1", "loc-1", AuditStatus.InProgress, []);
    expect(() => audit.reconcile()).toThrow(/Only completed audits can be reconciled/i);
  });
});
