export const Logger = {
  info: (context: string, action: string, data: Record<string, any> = {}, message?: string) => {
    console.info(JSON.stringify({ context, action, ...data, ...(message ? { message } : {}) }));
  },
  warn: (context: string, action: string, data: Record<string, any> = {}, message?: string) => {
    console.warn(JSON.stringify({ context, action, ...data, ...(message ? { message } : {}) }));
  },
  error: (context: string, action: string, data: Record<string, any> = {}, message?: string, error?: any) => {
    console.error(JSON.stringify({ context, action, ...data, ...(message ? { message } : {}), ...(error ? { error } : {}) }));
  }
};
