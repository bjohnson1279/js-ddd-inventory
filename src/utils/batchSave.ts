export async function batchSave<T>(repository: any, items: T[]): Promise<void> {
  if (items.length === 0) return;
  if ('saveMany' in repository && typeof repository.saveMany === 'function') {
    await repository.saveMany(items);
  } else {
    // Optimization: Bounded concurrency chunking
    // Fallback batch save uses bounded Promise.all to prevent database connection pool
    // exhaustion and avoid O(N) linear slowdowns caused by sequential execution.
    const CHUNK_SIZE = 10;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map((item) => repository.save(item)));
    }
  }
}
// Utility to batch save entities optimally
