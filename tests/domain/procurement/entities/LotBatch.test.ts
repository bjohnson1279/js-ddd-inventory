import { LotBatch, LotStatus } from "../../../../src/domain/procurement/entities/LotBatch";

describe("LotBatch Domain Entity", () => {
  const defaultTenant = "tenant-test-1";
  const defaultLotNumber = "LOT-2026-001";
  const defaultVariantId = "VAR-SKU-999";

  describe("Initialization & Defaults", () => {
    it("should instantiate with default status 'ACTIVE' and current createdAt date", () => {
      const before = new Date();
      const lot = new LotBatch("lot-id-1", defaultTenant, defaultLotNumber, defaultVariantId);
      const after = new Date();

      expect(lot.id).toBe("lot-id-1");
      expect(lot.tenantId).toBe(defaultTenant);
      expect(lot.lotNumber).toBe(defaultLotNumber);
      expect(lot.variantId).toBe(defaultVariantId);
      expect(lot.status).toBe("ACTIVE");
      expect(lot.manufacturedDate).toBeUndefined();
      expect(lot.expirationDate).toBeUndefined();
      expect(lot.supplierId).toBeUndefined();
      expect(lot.quarantinedAt).toBeUndefined();
      expect(lot.quarantineReason).toBeUndefined();
      expect(lot.recalledAt).toBeUndefined();
      expect(lot.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(lot.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should retain explicit optional parameters when provided", () => {
      const mfg = new Date("2026-01-01T00:00:00.000Z");
      const exp = new Date("2027-01-01T00:00:00.000Z");
      const created = new Date("2026-01-05T00:00:00.000Z");

      const lot = new LotBatch(
        "lot-id-2",
        defaultTenant,
        defaultLotNumber,
        defaultVariantId,
        "QUARANTINED",
        mfg,
        exp,
        "SUPPLIER-100",
        undefined,
        undefined,
        undefined,
        created
      );

      expect(lot.status).toBe("QUARANTINED");
      expect(lot.manufacturedDate).toEqual(mfg);
      expect(lot.expirationDate).toEqual(exp);
      expect(lot.supplierId).toBe("SUPPLIER-100");
      expect(lot.createdAt).toEqual(created);
    });
  });

  describe("Availability Checks (isAvailable)", () => {
    it("should be available if status is ACTIVE and expirationDate is undefined", () => {
      const lot = new LotBatch("lot-1", defaultTenant, defaultLotNumber, defaultVariantId, "ACTIVE");
      expect(lot.isAvailable()).toBe(true);
    });

    it("should be available if status is ACTIVE and expirationDate is in the future", () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour in future
      const lot = new LotBatch(
        "lot-1",
        defaultTenant,
        defaultLotNumber,
        defaultVariantId,
        "ACTIVE",
        undefined,
        futureDate
      );
      expect(lot.isAvailable()).toBe(true);
    });

    it("should not be available if status is ACTIVE but expirationDate is in the past", () => {
      const pastDate = new Date(Date.now() - 1000);
      const lot = new LotBatch(
        "lot-1",
        defaultTenant,
        defaultLotNumber,
        defaultVariantId,
        "ACTIVE",
        undefined,
        pastDate
      );
      expect(lot.isAvailable()).toBe(false);
    });

    it("should not be available if expirationDate is exactly now or past", () => {
      const now = new Date();
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const lot = new LotBatch(
        "lot-1",
        defaultTenant,
        defaultLotNumber,
        defaultVariantId,
        "ACTIVE",
        undefined,
        now
      );
      expect(lot.isAvailable()).toBe(false);

      jest.useRealTimers();
    });

    it.each<LotStatus>(["QUARANTINED", "RECALLED", "EXPIRED"])(
      "should not be available if status is '%s', regardless of expiration date",
      (nonActiveStatus) => {
        const futureDate = new Date(Date.now() + 100000);
        const lot = new LotBatch(
          "lot-1",
          defaultTenant,
          defaultLotNumber,
          defaultVariantId,
          nonActiveStatus,
          undefined,
          futureDate
        );
        expect(lot.isAvailable()).toBe(false);
      }
    );
  });

  describe("State Transitions (quarantine, recall, release)", () => {
    it("should quarantine an active lot with reason and timestamp", () => {
      const lot = new LotBatch("lot-1", defaultTenant, defaultLotNumber, defaultVariantId);
      const before = new Date();

      lot.quarantine("Suspected contamination");
      const after = new Date();

      expect(lot.status).toBe("QUARANTINED");
      expect(lot.quarantineReason).toBe("Suspected contamination");
      expect(lot.quarantinedAt).toBeInstanceOf(Date);
      expect(lot.quarantinedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(lot.quarantinedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(lot.isAvailable()).toBe(false);
    });

    it("should recall a lot with reason and timestamp", () => {
      const lot = new LotBatch("lot-1", defaultTenant, defaultLotNumber, defaultVariantId);
      const before = new Date();

      lot.recall("FDA Class I recall notice");
      const after = new Date();

      expect(lot.status).toBe("RECALLED");
      expect(lot.quarantineReason).toBe("FDA Class I recall notice");
      expect(lot.recalledAt).toBeInstanceOf(Date);
      expect(lot.recalledAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(lot.recalledAt!.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(lot.isAvailable()).toBe(false);
    });

    it("should release a quarantined lot back to ACTIVE and clear quarantine details", () => {
      const lot = new LotBatch("lot-1", defaultTenant, defaultLotNumber, defaultVariantId);
      lot.quarantine("Quality inspection pending");
      expect(lot.status).toBe("QUARANTINED");

      lot.release();

      expect(lot.status).toBe("ACTIVE");
      expect(lot.quarantinedAt).toBeUndefined();
      expect(lot.quarantineReason).toBeUndefined();
      expect(lot.recalledAt).toBeUndefined();
      expect(lot.isAvailable()).toBe(true);
    });

    it("should release a recalled lot back to ACTIVE and clear recall details", () => {
      const lot = new LotBatch("lot-1", defaultTenant, defaultLotNumber, defaultVariantId);
      lot.recall("Precautionary recall");
      expect(lot.status).toBe("RECALLED");

      lot.release();

      expect(lot.status).toBe("ACTIVE");
      expect(lot.quarantinedAt).toBeUndefined();
      expect(lot.quarantineReason).toBeUndefined();
      expect(lot.recalledAt).toBeUndefined();
      expect(lot.isAvailable()).toBe(true);
    });
  });
});
