import { StockOnboarding } from "../../../../src/domain/onboarding/aggregates/StockOnboarding";

describe("StockOnboarding", () => {
  it("should throw error when calling methods after submission (assertDraft)", () => {
    const onboarding = new StockOnboarding("ob-1", "loc-1", new Date());

    // Add an item so we can submit
    onboarding.setItem("sku-1", 100, 1500);

    // Submit the onboarding, changing its status from Draft to Submitted
    onboarding.submit();

    // Verify setItem throws
    expect(() => {
      onboarding.setItem("sku-2", 50, 2000);
    }).toThrow();

    // Verify removeItem throws
    expect(() => {
      onboarding.removeItem("sku-1");
    }).toThrow();

    // Verify submit throws
    expect(() => {
      onboarding.submit();
    }).toThrow();
  });
});
