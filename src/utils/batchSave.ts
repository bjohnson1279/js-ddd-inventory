export async function batchSave<T>(repository: any, items: T[]): Promise<void> {
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
