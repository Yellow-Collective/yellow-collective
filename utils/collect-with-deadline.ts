/** Keep completed results, cap upstream concurrency, and stop scheduling at the deadline. */
export async function collectWithDeadline<T, R>(
  items: readonly T[],
  load: (item: T) => Promise<R>,
  { concurrency = 8, timeoutMs = 6_000 } = {}
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const worker = async () => {
    while (!stopped && next < items.length) {
      const item = items[next++];
      try {
        const result = await load(item);
        if (!stopped) results.push(result);
      } catch {
        // One failed enrichment must not discard the other completed results.
      }
    }
  };
  try {
    await Promise.race([
      Promise.all(
        Array.from({ length: Math.min(concurrency, items.length) }, worker)
      ),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    stopped = true;
    clearTimeout(timer);
  }
  return results;
}
