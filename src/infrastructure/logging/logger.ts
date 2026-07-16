export class Logger {
  public static info(context: Record<string, any>): void {
    console.info(JSON.stringify(context));
  }

  public static warn(context: Record<string, any>): void {
    console.warn(JSON.stringify(context));
  }

  public static error(context: Record<string, any>, err?: any): void {
    const errorContext = err
      ? { ...context, error: err instanceof Error ? err.stack || err.message : err }
      : context;

    console.error(JSON.stringify(errorContext));
  }
}
