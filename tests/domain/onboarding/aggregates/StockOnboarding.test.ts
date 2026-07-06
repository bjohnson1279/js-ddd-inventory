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

  it("should enforce draft state validation", () => {
    const onboarding = new StockOnboarding("ob-state-test", "loc-1", new Date());

    // Change the aggregate status from Draft to something else
    onboarding.setItem("item-1", 10, 100);
    onboarding.submit();

    // Call a method that asserts draft state and verify it throws
    expect(() => {
      onboarding.setItem("item-2", 5, 50);
    }).toThrow(Error);
  });
});
