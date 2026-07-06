import { AsyncLocalStorage } from "async_hooks";

export const tenantLocalStorage = new AsyncLocalStorage<string>();
