export async function batchSave<T>(repository: any, items: T[]): Promise<void> {
  if (items.length === 0) return;
  if ('saveMany' in repository && typeof repository.saveMany === 'function') {
    await repository.saveMany(items);
  } else {
    for (let i = 0; i < items.length; i += 50) {
      const chunk = items.slice(i, i + 50);
      await Promise.all(chunk.map((item) => repository.save(item)));
    }
  }
}
