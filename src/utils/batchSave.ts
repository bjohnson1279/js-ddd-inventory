export async function batchSave<T>(repository: any, items: T[]): Promise<void> {
  if (items.length === 0) return;
  if ('saveMany' in repository && typeof repository.saveMany === 'function') {
    await repository.saveMany(items);
  } else {
    await Promise.all(items.map((item) => repository.save(item)));
  }
}
