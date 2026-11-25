// unstable_cache with a direct-read fallback for code that runs outside a Next request
// context (unit tests, scripts), where unstable_cache itself throws.
//
// The reader's own errors are tagged on the way out of the cached function, so the
// outer catch can tell "the read failed" (rethrow it as is, never read again) from
// "there is no request context" (read once directly). A failed read throws inside
// unstable_cache, and unstable_cache stores only a resolved value, so a failure is
// never cached.
import { unstable_cache } from "next/cache";

class ReaderFailed extends Error {
  constructor(readonly inner: unknown) {
    super("cached read failed");
  }
}

export function cachedWithFallback<T>(
  read: () => Promise<T>,
  keyParts: string[],
  options: { revalidate: number; tags: string[] },
): () => Promise<T> {
  const cached = unstable_cache(
    async () => {
      try {
        return await read();
      } catch (e) {
        throw new ReaderFailed(e);
      }
    },
    keyParts,
    options,
  );
  return async () => {
    try {
      return await cached();
    } catch (e) {
      if (e instanceof ReaderFailed) throw e.inner;
      // Outside a Next request context (unit tests, scripts) unstable_cache throws.
      return read();
    }
  };
}
