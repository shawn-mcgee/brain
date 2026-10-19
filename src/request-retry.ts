export class BackendBusy extends Error {}
export function retryDelay(attempt: number, random = Math.random()): number {
  return Math.min(8000, 750 * 2 ** attempt) + Math.floor(random * 500);
}
export function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
export async function retryBusy<T>(
  operation: () => Promise<T>,
  signal?: AbortSignal,
  wait = pause,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof BackendBusy)) throw error;
      if (attempt >= 4)
        throw new Error(
          "The Sheet is still busy after several retries. Close any duplicate Brain tabs and try again shortly.",
        );
      await wait(retryDelay(attempt), signal);
    }
  }
}
