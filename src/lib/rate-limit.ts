// Per-process protection. Multi-instance deployments should also enforce limits at the gateway.
const windows = new Map<string, { count: number; until: number }>();
export function consumeAttempt(key: string, limit: number, windowMs: number, now = Date.now()): number {
  for (const [stored, value] of windows) if (value.until <= now) windows.delete(stored);
  let window = windows.get(key);
  if (!window) {
    if (windows.size >= 10000) return Math.ceil(windowMs / 1000);
    window = { count: 0, until: now + windowMs };
    windows.set(key, window);
  }
  if (window.count >= limit) return Math.max(1, Math.ceil((window.until - now) / 1000));
  window.count++;
  return 0;
}
