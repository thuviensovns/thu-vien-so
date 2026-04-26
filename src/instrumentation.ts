/**
 * Next.js startup hook — runs once when the server boots.
 *
 * Sharp (used internally by next/image and Payload media) defaults to spawning
 * `os.cpus().length` libvips worker threads per operation. On a 4-CPU shared
 * host that means up to 16 concurrent threads when 4 images are processed in
 * parallel — and CloudLinux LVE counts threads against the NPROC limit.
 *
 * Pin Sharp to 1 thread per operation and cap its memory cache to keep
 * total process count well under the Vietnix shared-hosting NPROC=100 limit.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const sharp = (await import('sharp')).default
      sharp.concurrency(1)
      sharp.cache({ memory: 50, files: 20, items: 100 })
      // eslint-disable-next-line no-console
      console.log('[instrumentation] sharp pinned to 1 thread, cache=50MB')
    } catch (e) {
      console.warn('[instrumentation] sharp tuning skipped:', e)
    }
  }
}
