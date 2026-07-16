import { Logger } from "../../../src/infrastructure/logging/logger";

describe("Logger", () => {
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("should log info messages as JSON string", () => {
    Logger.info({ message: "test info", value: 123 });
    expect(infoSpy).toHaveBeenCalledWith('{"message":"test info","value":123}');
  });

  it("should log warn messages as JSON string", () => {
    Logger.warn({ message: "test warn", value: 456 });
    expect(warnSpy).toHaveBeenCalledWith('{"message":"test warn","value":456}');
  });

  it("should log error messages as JSON string", () => {
    Logger.error({ message: "test error" });
    expect(errorSpy).toHaveBeenCalledWith('{"message":"test error"}');
  });

  it("should log error messages with Error instance details", () => {
    const err = new Error("Sample database error");
    Logger.error({ message: "test db error" }, err);

    expect(errorSpy).toHaveBeenCalled();
    const loggedString = errorSpy.mock.calls[0][0];
    const loggedObj = JSON.parse(loggedString);
    expect(loggedObj.message).toBe("test db error");
    expect(loggedObj.error).toContain("Sample database error");
  });

  it("should log error messages with raw string details", () => {
    Logger.error({ message: "test raw error" }, "Simple failure string");

    expect(errorSpy).toHaveBeenCalledWith('{"message":"test raw error","error":"Simple failure string"}');
  });
});
