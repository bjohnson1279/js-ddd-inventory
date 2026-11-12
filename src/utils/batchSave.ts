export interface BatchSaveRepository<T> {
  save(item: T): Promise<void> | void;
  saveMany?(items: T[]): Promise<void> | void;
}

export async function batchSave<T>(repository: BatchSaveRepository<T>, items: T[]): Promise<void> {
  if (items.length === 0) return;
  if ('saveMany' in repository && typeof repository.saveMany === 'function') {
    await repository.saveMany(items);
  } else {
    for (const item of items) {
      await repository.save(item);
    }
  }
}
// Utility to batch save entities optimally
