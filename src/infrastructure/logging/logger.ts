export class Logger {
  public static info(message: string, context?: Record<string, unknown>): void {
    console.info(JSON.stringify({ level: "info", message, ...context }));
  }

  public static warn(message: string, context?: Record<string, unknown>): void {
    console.warn(JSON.stringify({ level: "warn", message, ...context }));
  }

  public static error(message: string, err?: unknown, context?: Record<string, unknown>): void {
    const errorDetails = err !== undefined ? {
      error: err instanceof Error ? err.stack || err.message : err
    } : {};

    console.error(JSON.stringify({ level: "error", message, ...errorDetails, ...context }));
  }
}
